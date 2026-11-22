// @vitest-environment jsdom
// Check Request / Inspection Status (ELEV-55): a empresa de manutenção e o gestor acompanham os
// pedidos de inspeção vindos da API. Monta-se a app num DOM e simula-se o fetch, porque o
// renderToString dos outros testes não corre efeitos.
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, test, vi } from 'vitest';
import { createRoutes } from '@/app/App';
import { listRequests, loadRequests, toTrackedRequest } from '@/features/inspections/api';

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
    process_number: '2026/0341',
    type: 'periodic',
    equipment_type: 'elevator',
    status: 'scheduled',
    submitted_at: '2026-10-02T09:15:00',
    scheduled_at: '2026-11-19T10:00:00',
    elevator: {
      id: 7,
      internal_reference: '01.05.0154',
      dge_number: 'DGE-99154',
      address: 'Avenida Lourenço Peixinho 50',
      maintenance_company: { name: 'Elevar, Lda.', phone: null, email: null },
    },
    inspection_company: { name: 'Inspeção Centro, S.A.', phone: null, email: null },
    inspection: null,
    ...fields,
  };
}

const requests = [
  apiRequest({
    id: 2,
    process_number: '2026/0388',
    status: 'awaiting_scheduling',
    scheduled_at: null,
    elevator: { ...apiRequest().elevator, address: 'Rua do Gravito 18' },
  }),
  apiRequest(),
];

/** Responde aos pedidos de inspeção com `answer` (lista ou código de erro), aos elevadores
 * com `elevators`; o resto, vazio. */
function stubApi(answer, elevators = () => []) {
  const fetch = vi.fn(async (url) => {
    const routes = {
      '/api/inspections/requests?open=true': answer,
      '/api/elevators': elevators,
    };
    const value = String(url) in routes ? routes[String(url)]() : [];
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

test('os pedidos são pedidos em nome do perfil', async () => {
  const fetch = stubApi(() => []);

  await listRequests('manutencao');

  const [url, init] = fetch.mock.calls[0];
  // Só os pedidos em aberto: os concluídos ficam no histórico de cada elevador.
  assert.equal(url, '/api/inspections/requests?open=true');
  assert.equal(init.headers['X-User-Id'], 'seed-maintenance');
});

test('um pedido acompanhado traz a empresa de inspeção e o id do elevador', () => {
  const request = toTrackedRequest(apiRequest());

  assert.equal(request.status, 'Agendado');
  assert.equal(request.address, 'Avenida Lourenço Peixinho 50');
  assert.equal(request.inspectionCompany, 'Inspeção Centro, S.A.');
  assert.equal(request.elevatorKey, 7);
  assert.equal(request.dge, 'DGE-99154');
});

test('a carga entrega os pedidos já convertidos', async () => {
  stubApi(() => requests);
  const onLoad = vi.fn();

  loadRequests('gestor', onLoad, vi.fn());

  await vi.waitFor(() => assert.equal(onLoad.mock.calls.length, 1));
  assert.deepEqual(
    onLoad.mock.calls[0][0].map((r) => r.status),
    ['Por agendar', 'Agendado'],
  );
});

test('a empresa de manutenção vê os pedidos da API e as visitas agendadas', async () => {
  stubApi(() => requests);
  await mount('manutencao', '/inspecoes');

  // A tabela só mostra os que ainda não estão agendados.
  assert.match(main(), /2026\/0388/);
  assert.match(main(), /Rua do Gravito 18/);
  // O n.º DGE vem da API, não dos dados de exemplo.
  assert.match(main(), /DGE-99154/);
  // O agendado aparece nas visitas, com a morada e a empresa de inspeção que o trata.
  assert.match(main(), /Avenida Lourenço Peixinho 50 · 10:00/);
  assert.match(main(), /Inspeção Centro, S\.A\./);
  // Já não mostra os dados de exemplo.
  assert.doesNotMatch(main(), /2026\/0377/);
});

test('o gestor vê o aviso de erro e pode tentar de novo', async () => {
  let fail = true;
  stubApi(() => (fail ? 500 : requests));
  await mount('gestor', '/pedidos');

  assert.match(main(), /Não foi possível carregar os pedidos de inspeção\./);
  assert.doesNotMatch(main(), /A carregar pedidos/);

  fail = false;
  const retry = [...document.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === 'Tentar novamente',
  );
  act(() => retry.click());
  await settle();

  assert.doesNotMatch(main(), /Não foi possível carregar/);
  assert.match(main(), /2026\/0388/);
  assert.match(main(), /2026\/0341/);
});

test('a referência num pedido abre a ficha pelo id que vem com o pedido', async () => {
  stubApi(() => requests);
  const router = await mount('gestor', '/pedidos');

  const link = [...document.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === '01.05.0154',
  );
  act(() => link.click());
  await settle();

  assert.equal(router.state.location.pathname, '/historico/7');
});

function apiElevator(fields = {}) {
  return {
    id: 3,
    internal_reference: '01.05.0203',
    dge_number: null,
    address: 'Rua João Mendonça 5',
    postal_code: '3810-000',
    parish: 'Glória e Vera Cruz',
    building: null,
    owner: { name: 'Condomínio Mendonça 5' },
    maintenance_company: { name: 'Ascende, Lda.' },
    inspection_company: { name: 'Inspeção Centro, S.A.' },
    certificate_status: 'due_soon',
    valid_until: '2026-12-12',
    latest_request: null,
    ...fields,
  };
}

test('os prazos próximos são os elevadores da empresa com o certificado a vencer', async () => {
  stubApi(
    () => requests,
    () => [
      apiElevator(),
      apiElevator({ id: 4, internal_reference: '01.05.0300', certificate_status: 'valid' }),
    ],
  );
  await mount('manutencao', '/inspecoes');

  assert.match(main(), /01\.05\.0203/);
  assert.match(main(), /Rua João Mendonça 5/);
  assert.doesNotMatch(main(), /01\.05\.0300/);
  assert.doesNotMatch(main(), /A carregar/);
});

test('os painéis da manutenção dizem que estão a carregar', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  await mount('manutencao', '/inspecoes');

  assert.match(main(), /A carregar prazos…/);
  assert.match(main(), /A carregar visitas…/);
});

test('os prazos avisam quando os elevadores não carregam', async () => {
  stubApi(
    () => requests,
    () => 500,
  );
  await mount('manutencao', '/inspecoes');

  assert.match(main(), /Não foi possível carregar os prazos\./);
});
