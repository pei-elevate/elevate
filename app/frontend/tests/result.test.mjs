// @vitest-environment jsdom
// Submit Inspection Results (ELEV-56): a empresa de inspeção submete o resultado e o PDF de um
// pedido agendado, pela API. Monta-se a app num DOM e simula-se o fetch, como em
// schedule.test.mjs.
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, test, vi } from 'vitest';
import { createRoutes } from '@/app/App';
import { resultError, submitResult } from '@/features/inspections/api';
import { ApiError } from '@/shared/api/client';

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
  HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
  };
});

let root;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function apiRequest(fields = {}) {
  return {
    id: 3,
    process_number: '2026/0341',
    type: 'periodic',
    equipment_type: 'elevator',
    status: 'scheduled',
    submitted_at: '2026-10-02T00:00:00',
    scheduled_at: '2026-11-19T10:00:00',
    elevator: {
      internal_reference: '01.05.0154',
      dge_number: 'DGE-10154',
      address: 'Av. Dr. Lourenço Peixinho 85',
      maintenance_company: { name: 'Elevar, Lda.', phone: null, email: null },
    },
    inspection: null,
    ...fields,
  };
}

const assigned = [
  apiRequest(),
  apiRequest({ id: 5, process_number: '2026/0377', status: 'awaiting_scheduling' }),
];

/** Responde aos atribuídos com `answer()` e ao envio do resultado com `submitted()`. */
function stubApi(answer = () => assigned, submitted = () => 200) {
  const fetch = vi.fn(async (url, init = {}) => {
    const json = (status, body) => new Response(JSON.stringify(body), { status });

    if (init.method === 'POST' && /\/result$/.test(String(url))) {
      const status = submitted();
      return status < 300 ? json(status, apiRequest({ status: 'completed' })) : json(status, {});
    }
    return json(200, String(url) === '/api/inspections/assigned' ? answer() : []);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const posts = (fetch) => fetch.mock.calls.filter(([, init]) => init?.method === 'POST');

async function settle() {
  for (let i = 0; i < 4; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve));
    });
}

async function mount(path) {
  const router = createMemoryRouter(createRoutes('inspecao'), { initialEntries: [path] });
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(RouterProvider, { router })));
  await settle();
  return router;
}

const main = () => document.querySelector('main').textContent;
const page = () => document.body.textContent;

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

/** Muda um campo como o utilizador, para o React ver a alteração. */
function set(name, value) {
  const element = document.querySelector(`[name="${name}"]`);
  const prototype = Object.getPrototypeOf(element);
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(
    new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }),
  );
}

const pdf = () => new File(['%PDF-1.4\n%%EOF\n'], 'relatorio.pdf', { type: 'application/pdf' });

function attach(file) {
  const input = document.querySelector('#document');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function fill(fields, file = pdf()) {
  await act(async () => {
    for (const [name, value] of Object.entries(fields)) set(name, value);
    if (file) attach(file);
  });
}

async function send() {
  await act(async () => {
    document.querySelector('main form').requestSubmit();
  });
}

test('submeter envia os dados e o PDF ao pedido certo, em nome da empresa de inspeção', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify(apiRequest()), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  const report = pdf();

  await submitResult(
    'inspecao',
    7,
    { result: 'Aprovada', performed: '2026-11-19', validUntil: '2028-11-19', deadline: '' },
    report,
  );

  const [url, init] = fetch.mock.calls[0];
  assert.equal(url, '/api/inspections/requests/7/result');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['X-User-Id'], 'seed-inspection');
  // O browser escolhe o Content-Type (multipart, com a fronteira) quando o corpo é FormData.
  assert.equal(init.headers['Content-Type'], undefined);
  assert.ok(init.body instanceof FormData);
  assert.equal(init.body.get('result'), 'approved');
  assert.equal(init.body.get('performed_date'), '2026-11-19');
  assert.equal(init.body.get('valid_until'), '2028-11-19');
  assert.equal(init.body.get('correction_deadline'), null);
  assert.equal(init.body.get('report').name, 'relatorio.pdf');
});

test('os erros do resultado têm mensagens em português', () => {
  assert.equal(
    resultError(new ApiError(409, 'x')),
    'Este pedido já não está agendado: pode já ter resultado. Atualize a lista.',
  );
  assert.equal(
    resultError(new ApiError(422, 'x')),
    'Verifique os dados do resultado e o PDF (até 10 MB).',
  );
  assert.equal(
    resultError(new ApiError(500, 'x')),
    'Não foi possível submeter o resultado. Tente novamente.',
  );
  assert.equal(
    resultError(new TypeError('Failed to fetch')),
    'Não foi possível submeter o resultado. Tente novamente.',
  );
});

test('enquanto a lista carrega, o formulário avisa', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  await mount('/resultado/2026%2F0341');

  assert.match(main(), /A carregar pedido/);
  assert.equal(document.querySelector('main form'), null);
});

test('o formulário abre um pedido agendado vindo da API', async () => {
  stubApi();
  await mount('/resultado/2026%2F0341');

  assert.match(main(), /Submeter resultado da inspeção/);
  assert.match(main(), /Av\. Dr\. Lourenço Peixinho 85/);
  assert.match(main(), /Agendada para19\/11\/2026 · 10:00/);
});

test('uma inspeção aprovada é gravada na API e volta às atribuídas', async () => {
  let list = assigned;
  const fetch = stubApi(() => list);
  const router = await mount('/resultado/2026%2F0341');

  list = [apiRequest({ status: 'completed' }), assigned[1]];
  await fill({ performed: '19/11/2026', validUntil: '19/11/2028' });
  await send();

  await until(() => assert.equal(router.state.location.pathname, '/atribuidas'));
  const [[url, init]] = posts(fetch);
  assert.equal(url, '/api/inspections/requests/3/result');
  assert.equal(init.body.get('result'), 'approved');
  assert.equal(init.body.get('performed_date'), '2026-11-19');
  assert.equal(init.body.get('valid_until'), '2028-11-19');
  assert.match(page(), /Resultado submetido/);
  // A lista volta a ser pedida, com o pedido já concluído.
  assert.ok(fetch.mock.calls.filter(([u]) => u === '/api/inspections/assigned').length >= 2);
});

test('uma inspeção reprovada envia as não conformidades e o prazo', async () => {
  const fetch = stubApi();
  await mount('/resultado/2026%2F0341');

  await fill({ result: 'Reprovada' }, null);
  await fill({
    performed: '19/11/2026',
    deadline: '19/01/2027',
    nonconformities: 'Porta de patamar sem encravamento.',
  });
  await send();

  await until(() => assert.equal(posts(fetch).length, 1));
  const body = posts(fetch)[0][1].body;
  assert.equal(body.get('result'), 'failed');
  assert.equal(body.get('correction_deadline'), '2027-01-19');
  assert.equal(body.get('nonconformities'), 'Porta de patamar sem encravamento.');
  assert.equal(body.get('valid_until'), null);
});

test('um 409 deixa o formulário aberto com a mensagem', async () => {
  const fetch = stubApi(
    () => assigned,
    () => 409,
  );
  const router = await mount('/resultado/2026%2F0341');

  await fill({ performed: '19/11/2026', validUntil: '19/11/2028' });
  await send();

  await until(() =>
    assert.match(
      document.querySelector('[role="alert"]')?.textContent ?? '',
      /Este pedido já não está agendado/,
    ),
  );
  assert.equal(posts(fetch).length, 1);
  assert.equal(router.state.location.pathname, '/resultado/2026%2F0341');
});

test('sem PDF o resultado não chega à API', async () => {
  const fetch = stubApi();
  await mount('/resultado/2026%2F0341');

  await fill({ performed: '19/11/2026', validUntil: '19/11/2028' }, null);
  await send();

  assert.match(main(), /Anexe o relatório ou certificado em PDF/);
  assert.equal(posts(fetch).length, 0);
});

test('um pedido por agendar não abre o formulário', async () => {
  stubApi();
  await mount('/resultado/2026%2F0377');

  assert.match(main(), /Ação indisponível/);
  assert.equal(document.querySelector('main form'), null);
});
