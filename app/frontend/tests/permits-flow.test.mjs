// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { createRoutes } from '@/app/App';

// Fluxos do Urbanismo e do gestor sobre os alvarás, montados no DOM com a API simulada.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let container;

beforeEach(() => {
  // O jsdom não implementa estes métodos do browser.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
  window.scrollTo = () => {};
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  root = undefined;
  vi.unstubAllGlobals();
});

const permit = (id, status, fields = {}) => ({
  id,
  permit_number: `${id}/2026`,
  permit_date: '2026-09-11',
  address: `Rua de Viseu ${id}`,
  num_elevators: 1,
  postal_code: '3810-000',
  parish: 'Glória e Vera Cruz',
  owner_name: `Condomínio Viseu ${id}`,
  registered: status === 'registered' ? 1 : 0,
  pending: status === 'pending' ? 1 : 0,
  missing: status === 'missing' ? 1 : 0,
  status,
  last_alert_at: null,
  ...fields,
});

/**
 * Simula a API: `GET /permits` devolve `permits` (ou falha com `listStatus`), `POST /permits`
 * responde com `createStatus` e os restantes GET devolvem os registos por validar.
 */
function stubApi({ permits = [], listStatus = 200, createStatus = 201, pending = [] } = {}) {
  const fetch = vi.fn(async (url, init) => {
    const json = (status, body) => new Response(JSON.stringify(body), { status });

    if (url === '/api/permits' && init.method === 'POST')
      return createStatus < 300
        ? json(createStatus, { id: 99 })
        : json(createStatus, { detail: 'x' });
    if (url === '/api/permits')
      return listStatus < 300 ? json(listStatus, permits) : json(listStatus, { detail: 'x' });

    return json(200, pending);
  });
  vi.stubGlobal('fetch', fetch);

  return fetch;
}

const calls = (fetch, method) =>
  fetch.mock.calls.filter(([url, init]) => url === '/api/permits' && init.method === method);

async function mount(role, path) {
  const router = createMemoryRouter(createRoutes(role), { initialEntries: [path] });
  await act(async () => {
    root = createRoot(container);
    root.render(createElement(RouterProvider, { router }));
  });

  return router;
}

/** Espera até `check` deixar de falhar (as respostas da API e a gravação são assíncronas). */
async function until(check, timeout = 2000) {
  const start = Date.now();

  for (;;) {
    try {
      return check();
    } catch (error) {
      if (Date.now() - start > timeout) throw error;
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    }
  }
}

const text = () => container.textContent;

function button(label) {
  const found = [...container.querySelectorAll('button')].find((b) =>
    b.textContent.includes(label),
  );
  assert.ok(found, `botão «${label}» em falta`);

  return found;
}

async function click(label) {
  await act(async () => button(label).click());
}

/** Escreve num campo como o utilizador, para o React ver a alteração. */
function type(name, value) {
  const input = container.querySelector(`[name="${name}"]`);
  const proto = input.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, value);
  input.dispatchEvent(
    new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
  );
}

async function fillValidPermit(number = '200/2026') {
  await act(async () => {
    type('permit', number);
    type('permitDate', '02/01/2025');
    type('address', 'Rua Nova 1');
    type('postal', '3800-100');
    type('parish', container.querySelector('[name="parish"] option:nth-child(2)').value);
    type('count', '2');
    type('owner', 'Condomínio Rua Nova');
    type('nif', '900000099');
    type('email', 'rua.nova@ex.pt');
  });
}

async function submit() {
  await act(async () => {
    container.querySelector('form').requestSubmit();
  });
}

test('o Urbanismo vê os alvarás da API e regista um novo', async () => {
  const fetch = stubApi({ permits: [permit(1, 'missing'), permit(2, 'registered')] });
  const router = await mount('urbanismo', '/avisos');

  await until(() => assert.match(text(), /Rua de Viseu 2/));
  assert.match(text(), /Rua de Viseu 1/);

  await click('Registar novo alvará');
  assert.equal(router.state.location.pathname, '/novo-aviso');

  // Sem dados, não chega à API.
  await submit();
  assert.match(text(), /Corrija os campos indicados abaixo/);
  assert.equal(calls(fetch, 'POST').length, 0);

  await fillValidPermit();
  await submit();

  await until(() => assert.equal(router.state.location.pathname, '/avisos'));
  assert.equal(calls(fetch, 'POST').length, 1);
  assert.equal(JSON.parse(calls(fetch, 'POST')[0][1].body).permit_number, '200/2026');
  assert.match(text(), /Alvará registado/);
  // A lista volta a ser pedida para mostrar o novo alvará.
  await until(() => assert.ok(calls(fetch, 'GET').length >= 2));
});

test('um número de alvará já na lista é recusado sem ir à API', async () => {
  const fetch = stubApi({ permits: [permit(1, 'missing')] });
  await mount('urbanismo', '/novo-aviso');
  await until(() => assert.equal(calls(fetch, 'GET').length, 1));

  await fillValidPermit('1/2026');
  await submit();

  assert.match(text(), /Já existe um alvará registado com este número\./);
  assert.equal(calls(fetch, 'POST').length, 0);
});

test('um 409 da API marca o número do alvará e o formulário fica por guardar', async () => {
  stubApi({ createStatus: 409 });
  const router = await mount('urbanismo', '/novo-aviso');

  await fillValidPermit();
  await submit();

  await until(() =>
    assert.equal(
      container.querySelector('#permit-error')?.textContent,
      'Já existe um alvará registado com este número.',
    ),
  );
  assert.equal(router.state.location.pathname, '/novo-aviso');
  assert.equal(button('Guardar alvará').disabled, false);
});

test('outro erro da API aparece num alerta acima do formulário', async () => {
  stubApi({ createStatus: 500 });
  const router = await mount('urbanismo', '/novo-aviso');

  await fillValidPermit();
  await submit();

  await until(() =>
    assert.match(
      container.querySelector('[role="alert"]')?.textContent ?? '',
      /Não foi possível guardar o alvará\. Tente novamente\./,
    ),
  );
  assert.equal(router.state.location.pathname, '/novo-aviso');
});

test('se a lista falhar, «Tentar novamente» volta a pedi-la', async () => {
  const fetch = stubApi({ listStatus: 500 });
  await mount('urbanismo', '/avisos');

  await until(() => assert.match(text(), /Não foi possível carregar os alvarás\./));

  stubApi({ permits: [permit(1, 'missing')] });
  await click('Tentar novamente');

  await until(() => assert.match(text(), /Rua de Viseu 1/));
  assert.equal(calls(fetch, 'GET').length, 1);
});

test('o gestor acompanha os alvarás por registar e emite alertas', async () => {
  stubApi({
    permits: [
      permit(1, 'missing'),
      permit(2, 'pending'),
      permit(3, 'registered'),
      permit(4, 'missing', { last_alert_at: '2026-10-05T10:00:00' }),
    ],
    pending: [{ id: 7, permit: { id: 2 } }],
  });
  const router = await mount('gestor', '/nao-registados');

  await until(() => assert.match(text(), /Rua de Viseu 1/));
  // Os registados não aparecem ao gestor; o menu conta os outros três.
  assert.doesNotMatch(text(), /Rua de Viseu 3/);
  const menuItem = [...container.querySelectorAll('nav button')].find((b) =>
    b.textContent.includes('Elevadores não registados'),
  );
  assert.equal(menuItem.querySelector('.nav-count')?.textContent, '3');
  assert.match(text(), /Emitido em 05\/10\/2026/);

  await click('Por validar');
  assert.doesNotMatch(text(), /Rua de Viseu 1/);
  await click('Todos');

  await click('Emitir alerta ao proprietário');
  assert.match(text(), /Registar um alerta relativo a Rua de Viseu 1\?/);
  await act(async () =>
    [...container.querySelectorAll('dialog button')]
      .find((b) => b.textContent === 'Emitir alerta')
      .click(),
  );
  assert.match(text(), /Alerta registado na demonstração\./);
  assert.equal(
    [...container.querySelectorAll('button')].filter((b) => b.textContent === 'Reemitir alerta')
      .length,
    2,
  );

  await until(() => assert.ok(button('Analisar')));
  await click('Analisar');
  assert.equal(router.state.location.pathname, '/validacoes/7');
});
