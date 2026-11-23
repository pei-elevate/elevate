// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { createRoutes } from '@/app/App';

// Registo de elevadores pela empresa de manutenção, montado no DOM com a API simulada.

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

const registration = (id, status, fields = {}) => ({
  id,
  internal_reference: null,
  registration_status: status,
  rejected_reason: status === 'rejected' ? 'Falta o contrato de manutenção.' : null,
  dge_number: null,
  address: `Rua do Gravito ${id}`,
  postal_code: '3810-000',
  parish: 'Glória e Vera Cruz',
  building: null,
  service_date: '2026-10-01',
  registration_document: 'contrato.pdf',
  owner: {
    type: 'individual',
    name: `Proprietário ${id}`,
    nif: '900000001',
    email: 'a@ex.pt',
    phone: null,
  },
  maintenance_company: { name: 'Elevar, Lda.' },
  permit: null,
  ...fields,
});

/**
 * Simula a API: `GET /registrations…` devolve `submitted`, o POST e o PUT dos registos
 * respondem com `saveStatus` (e `detail`), e os restantes GET devolvem listas vazias.
 */
function stubApi({ submitted = [], saveStatus = 201, detail = 'x' } = {}) {
  const fetch = vi.fn(async (url, init) => {
    const json = (status, body) => new Response(JSON.stringify(body), { status });

    if (url.startsWith('/api/registrations') && init.method !== 'GET')
      return saveStatus < 300
        ? json(saveStatus, registration(99, 'pending_approval'))
        : json(saveStatus, { detail });
    if (url.startsWith('/api/registrations')) return json(200, submitted);

    return json(200, []);
  });
  vi.stubGlobal('fetch', fetch);

  return fetch;
}

const saves = (fetch) =>
  fetch.mock.calls.filter(
    ([url, init]) => url.startsWith('/api/registrations') && init.method !== 'GET',
  );

async function mount(path) {
  const router = createMemoryRouter(createRoutes('manutencao'), { initialEntries: [path] });
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
const value = (name) => container.querySelector(`[name="${name}"]`).value;

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

async function fillValidRegistration() {
  await act(async () => {
    type('address', ' Rua Nova 1 ');
    type('postal', '3800-100');
    type('parish', 'Esgueira');
    type('block', 'Bloco B');
    type('ownerType', 'Pessoa coletiva');
    type('owner', 'Imobiliária Nova, S.A.');
    type('nif', '500000099');
    type('email', 'geral@nova.pt');
    type('service', '01/10/2026');
    type('dge', 'DGE-777');
  });
}

async function submit() {
  await act(async () => {
    container.querySelector('form').requestSubmit();
  });
}

test('a empresa de manutenção submete um registo novo', async () => {
  const fetch = stubApi();
  const router = await mount('/registar');

  // Sem dados, não chega à API.
  await submit();
  assert.match(text(), /Corrija os campos indicados abaixo/);
  assert.equal(saves(fetch).length, 0);

  await fillValidRegistration();
  await submit();

  await until(() => assert.equal(router.state.location.pathname, '/elevadores'));
  const [[url, init]] = saves(fetch);
  assert.equal(url, '/api/registrations');
  assert.equal(init.method, 'POST');
  assert.deepEqual(JSON.parse(init.body), {
    address: 'Rua Nova 1',
    postal_code: '3800-100',
    parish: 'Esgueira',
    building: 'Bloco B',
    service_date: '2026-10-01',
    dge_number: 'DGE-777',
    owner_type: 'company',
    owner_name: 'Imobiliária Nova, S.A.',
    owner_nif: '500000099',
    owner_email: 'geral@nova.pt',
    owner_phone: null,
    registration_document: null,
  });
  assert.match(text(), /Registo submetido\. Aguarda validação municipal\./);
});

test('um n.º DGE repetido fica marcado no seu campo', async () => {
  stubApi({ saveStatus: 409, detail: 'An elevator with this DGE number already exists' });
  const router = await mount('/registar');

  await fillValidRegistration();
  await submit();

  await until(() => assert.match(text(), /Já existe um elevador com este número DGE\./));
  assert.equal(container.querySelector('[name="dge"]').getAttribute('aria-invalid'), 'true');
  assert.equal(router.state.location.pathname, '/registar');
});

test('outro erro da API aparece num alerta acima do formulário', async () => {
  stubApi({ saveStatus: 500 });
  await mount('/registar');

  await fillValidRegistration();
  await submit();

  await until(() =>
    assert.match(
      container.querySelector('[role="alert"]').textContent,
      /Não foi possível submeter o registo/,
    ),
  );
});

test('a lista mostra os registos submetidos e o motivo da rejeição', async () => {
  stubApi({ submitted: [registration(7, 'rejected'), registration(8, 'pending_approval')] });
  const router = await mount('/elevadores');

  await until(() => assert.match(text(), /Registos submetidos/));
  assert.match(text(), /Rua do Gravito 7.*Rejeitado.*Falta o contrato de manutenção\./);
  assert.match(text(), /Rua do Gravito 8.*Por validar.*A aguardar referência interna/);

  await click('Corrigir e voltar a submeter');
  assert.equal(router.state.location.pathname, '/registar/7');
});

test('um registo rejeitado é corrigido e volta a ser submetido', async () => {
  const fetch = stubApi({ submitted: [registration(7, 'rejected')], saveStatus: 200 });
  const router = await mount('/registar/7');

  await until(() => assert.match(text(), /Corrigir registo/));
  assert.match(text(), /Motivo da rejeição anterior:\s*Falta o contrato de manutenção\./);
  assert.equal(value('address'), 'Rua do Gravito 7');
  assert.equal(value('ownerType'), 'Pessoa singular');
  assert.equal(value('service'), '01/10/2026');

  await act(async () => type('address', 'Rua do Gravito 7A'));
  await click('Voltar a submeter');

  await until(() => assert.equal(router.state.location.pathname, '/elevadores'));
  const [[url, init]] = saves(fetch);
  assert.equal(url, '/api/registrations/7');
  assert.equal(init.method, 'PUT');
  const body = JSON.parse(init.body);
  assert.equal(body.address, 'Rua do Gravito 7A');
  assert.equal(body.owner_type, 'individual');
  // Sem novo ficheiro, fica o documento que já tinha.
  assert.equal(body.registration_document, 'contrato.pdf');
  assert.match(text(), /Registo corrigido e novamente submetido para validação\./);
});

test('só um registo rejeitado da própria empresa se pode corrigir', async () => {
  stubApi({ submitted: [registration(8, 'pending_approval')] });

  await mount('/registar/8');
  await until(() => assert.match(text(), /Registo indisponível para correção/));

  act(() => root.unmount());
  root = undefined;
  await mount('/registar/999');
  await until(() => assert.match(text(), /Registo indisponível para correção/));
});

test('sem ligação ao backend, a correção permite tentar de novo', async () => {
  let fail = true;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) =>
      url.startsWith('/api/registrations') && fail
        ? new Response('{}', { status: 500 })
        : new Response(
            JSON.stringify(
              url.startsWith('/api/registrations') ? [registration(7, 'rejected')] : [],
            ),
            {
              status: 200,
            },
          ),
    ),
  );
  await mount('/registar/7');

  await until(() => assert.match(text(), /Não foi possível carregar o registo/));
  fail = false;
  await click('Tentar de novo');

  await until(() => assert.match(text(), /Corrigir registo/));
});
