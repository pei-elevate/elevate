// @vitest-environment jsdom
// Schedule Inspections (ELEV-52): a empresa de inspeção agenda os pedidos por agendar que vêm
// da API. Monta-se a app num DOM e simula-se o fetch, como em request-status.test.mjs.
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, test, vi } from 'vitest';
import { createRoutes } from '@/app/App';
import { scheduleError, scheduleRequest } from '@/features/inspections/api';
import { ApiError } from '@/shared/api/client';

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
  // O jsdom não tem estes dois.
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
    id: 1,
    process_number: '2026/0377',
    type: 'periodic',
    equipment_type: 'elevator',
    status: 'awaiting_scheduling',
    submitted_at: '2026-10-08T00:00:00',
    scheduled_at: null,
    elevator: {
      internal_reference: '01.05.0203',
      dge_number: 'DGE-10203',
      address: 'Rua João Mendonça 5',
      maintenance_company: { name: 'Elevar, Lda.', phone: null, email: null },
    },
    inspection: null,
    ...fields,
  };
}

// 2026/0401 chegou do MyDoc e não existe nos dados de exemplo do frontend.
const assigned = [
  apiRequest(),
  apiRequest({
    id: 9,
    process_number: '2026/0401',
    elevator: { ...apiRequest().elevator, internal_reference: '01.05.0079' },
  }),
  apiRequest({
    id: 3,
    process_number: '2026/0341',
    status: 'scheduled',
    scheduled_at: '2026-11-19T10:00:00',
  }),
];

/** Responde aos pedidos atribuídos com `answer` (lista ou código de erro); o resto, vazio. */
function stubApi(answer) {
  const fetch = vi.fn(async (url) => {
    const value = String(url) === '/api/inspections/assigned' ? answer() : [];
    return typeof value === 'number'
      ? new Response('{}', { status: value })
      : new Response(JSON.stringify(value), { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

async function settle() {
  for (let i = 0; i < 4; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve));
    });
}

async function mount(role, path) {
  const router = createMemoryRouter(createRoutes(role), { initialEntries: [path] });
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(RouterProvider, { router })));
  await settle();
  return router;
}

const main = () => document.querySelector('main').textContent;
const rows = () => [...document.querySelectorAll('main tbody tr')];
const badge = (label) =>
  [...document.querySelectorAll('nav .nav-item')]
    .find((item) => item.textContent.includes(label))
    ?.querySelector('.nav-count')?.textContent;

test('agendar envia a data ao pedido certo, em nome da empresa de inspeção', async () => {
  const fetch = vi.fn(
    async () => new Response(JSON.stringify(apiRequest({ status: 'scheduled' })), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetch);

  await scheduleRequest('inspecao', 7, '2026-12-02T10:00');

  const [url, init] = fetch.mock.calls[0];
  assert.equal(url, '/api/inspections/requests/7/schedule');
  assert.equal(init.method, 'POST');
  assert.deepEqual(JSON.parse(init.body), { scheduled_at: '2026-12-02T10:00' });
  assert.equal(init.headers['X-User-Id'], 'seed-inspection');
});

test('os erros do agendamento têm mensagens em português', () => {
  assert.equal(
    scheduleError(new ApiError(409, 'x')),
    'Este pedido já foi agendado ou concluído. Atualize a lista.',
  );
  assert.equal(scheduleError(new ApiError(422, 'x')), 'Escolha a data de hoje ou uma data futura.');
  assert.equal(
    scheduleError(new ApiError(500, 'x')),
    'Não foi possível agendar a inspeção. Tente novamente.',
  );
  assert.equal(
    scheduleError(new TypeError('Failed to fetch')),
    'Não foi possível agendar a inspeção. Tente novamente.',
  );
});

test('a lista para agendar mostra os pedidos por agendar da API', async () => {
  stubApi(() => assigned);
  await mount('inspecao', '/agendar');

  const listed = rows().map((row) => row.textContent);
  assert.equal(listed.length, 2);
  assert.match(listed.join(), /2026\/0377/);
  // Um pedido vindo do MyDoc, que os dados de exemplo não têm.
  assert.match(listed.join(), /2026\/0401/);
  assert.doesNotMatch(listed.join(), /2026\/0341/);
  assert.match(main(), /2 pedido\(s\)/);
  assert.equal(badge('Agendar inspeções'), '2');
});

test('a empresa de inspeção vê a referência sem ligação para a ficha', async () => {
  // Este perfil não consulta elevadores (a API dá 403): a ligação acabava em «não encontrado».
  stubApi(() => assigned);
  await mount('inspecao', '/agendar');

  assert.match(main(), /01\.05\.0203/);
  const buttons = [...document.querySelectorAll('main tbody button')].map((b) => b.textContent);
  assert.ok(!buttons.includes('01.05.0203'));
});

test('enquanto carrega, a lista para agendar avisa', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  await mount('inspecao', '/agendar');

  assert.match(main(), /A carregar pedidos/);
  assert.equal(rows().length, 0);
});

test('se a API falhar, a lista para agendar deixa tentar de novo', async () => {
  let answer = 500;
  const fetch = stubApi(() => answer);
  await mount('inspecao', '/agendar');

  assert.match(main(), /Não foi possível carregar os pedidos atribuídos/);

  answer = assigned;
  const retry = [...document.querySelectorAll('main button')].find(
    (b) => b.textContent === 'Tentar novamente',
  );
  act(() => retry.click());
  await settle();

  assert.equal(rows().length, 2);
  assert.ok(fetch.mock.calls.length >= 2);
});
