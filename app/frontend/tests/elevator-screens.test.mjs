// @vitest-environment jsdom
// Ecrãs dos elevadores com os dados já carregados da API (ELEV-54). O renderToString dos outros
// testes não corre efeitos, por isso aqui monta-se a app num DOM e simula-se o fetch.
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, test, vi } from 'vitest';
import { createRoutes } from '@/app/App';

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // O jsdom não tem estes dois.
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

function summary(fields = {}) {
  return {
    id: 1,
    internal_reference: '01.05.0079',
    dge_number: 'DGE-10079',
    address: 'Rua de Viseu 12',
    postal_code: '3810-000',
    parish: 'Glória e Vera Cruz',
    building: null,
    owner: { name: 'Condomínio Edifício Ria' },
    maintenance_company: { name: 'Elevar, Lda.' },
    inspection_company: { name: 'Inspeave, Lda.' },
    certificate_status: 'due_soon',
    valid_until: '2026-12-12',
    latest_request: {
      process_number: '2024/0611',
      submitted_at: '2024-10-02T09:15:00',
      type: 'periodic',
    },
    ...fields,
  };
}

const list = [
  summary(),
  summary({
    id: 5,
    internal_reference: '01.05.0231',
    dge_number: null,
    address: 'Rua Eng. Von Haff 40',
    owner: { name: 'Condomínio Von Haff 40' },
    certificate_status: 'failed',
    valid_until: null,
    latest_request: null,
  }),
];

const detail = {
  ...summary(),
  owner: {
    id: 1,
    type: 'condominium',
    name: 'Condomínio Edifício Ria',
    nif: '900000001',
    email: 'ria@exemplo.pt',
    phone: null,
  },
  maintenance_company: { name: 'Elevar, Lda.', email: 'geral@elevar.pt', phone: null },
  inspection_company: { name: 'Inspeave, Lda.', email: null, phone: null },
  equipment_type: 'elevator',
  service_date: '2015-01-01',
  created_at: '2026-01-10T10:00:00',
  last_inspection: { performed_date: '2024-12-14', result: 'approved' },
  permit: null,
};

const inspections = [
  {
    process_number: '2024/0611',
    submitted_at: '2024-10-02T09:15:00',
    type: 'periodic',
    inspection_company: { name: 'Inspeave, Lda.' },
    performed_date: '2024-12-14',
    result: 'approved',
    valid_until: '2026-12-12',
    report_file: 'relatorio-2024-0611.pdf',
  },
];

const notices = [
  {
    id: 2,
    type: 'inspection_required',
    subject: 'Inspeção necessária',
    body: 'O elevador 01.05.0079 precisa de ser inspecionado.',
    recipients: 'Condomínio Edifício Ria <ria@exemplo.pt>',
    created_at: '2026-11-02T11:30:00',
  },
];

/** fetch simulado: cada caminho da API responde com o corpo dado, ou com o estado se for número. */
function stubApi(routes) {
  const fetch = vi.fn(async (url) => {
    const path = String(url).replace(/^\/api/, '');
    const answer = path in routes ? routes[path] : [];
    const value = typeof answer === 'function' ? answer() : answer;
    return typeof value === 'number'
      ? new Response(JSON.stringify({ detail: 'erro' }), { status: value })
      : new Response(JSON.stringify(value), { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const api = {
  '/elevators': list,
  '/elevators/1': detail,
  '/elevators/1/inspections': inspections,
  '/elevators/1/notices': notices,
};

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
  return { router, text: () => container.textContent };
}

async function click(label) {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === label || b.textContent.trim() === label,
  );
  assert.ok(button, `botão «${label}» em falta`);
  act(() => button.click());
  await settle();
}

const main = () => document.querySelector('main').textContent;
const dialog = () => document.querySelector('dialog').textContent;

test('o proprietário vê a lista da API e abre a ficha pelo id', async () => {
  stubApi(api);
  const { router } = await mount('proprietario', '/elevadores');

  assert.match(main(), /01\.05\.0079/);
  assert.match(main(), /A vencer/);
  assert.match(main(), /2 de 2 elevadores/);

  await click('Consultar 01.05.0079');
  assert.equal(router.state.location.pathname, '/detalhes/1');
  assert.match(main(), /Elevador 01\.05\.0079/);
});

test('sem a lista da API, aparece o erro e não os mocks', async () => {
  let fail = true;
  stubApi({ ...api, '/elevators': () => (fail ? 500 : list) });
  await mount('proprietario', '/elevadores');

  assert.match(main(), /Não foi possível carregar os elevadores\./);
  assert.doesNotMatch(main(), /01\.05\.0112/);

  fail = false;
  await click('Tentar de novo');
  assert.match(main(), /01\.05\.0079/);
});

test('o painel do proprietário conta os elevadores da API', async () => {
  stubApi(api);
  await mount('proprietario', '/painel');

  assert.match(main(), /Elevadores registados2/);
  assert.match(main(), /A vencer1/);
  assert.match(main(), /01\.05\.0231/);
});

test('o painel do gestor mostra o erro da lista', async () => {
  stubApi({ ...api, '/elevators': 500 });
  await mount('gestor', '/painel');

  assert.match(main(), /Não foi possível carregar os elevadores\./);
});

test('a EMA vê as métricas da sua lista', async () => {
  stubApi(api);
  await mount('manutencao', '/elevadores');

  assert.match(main(), /Elevadores2/);
  assert.match(main(), /Reprovados1/);
});

test('o gestor filtra a lista da API', async () => {
  stubApi(api);
  await mount('gestor', '/cadastro');

  assert.match(main(), /2024\/0611/);
  const status = [...document.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => o.value === 'Reprovada'),
  );
  act(() => {
    status.value = 'Reprovada';
    status.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
  assert.match(main(), /1 de 2 elevadores/);
  assert.doesNotMatch(main(), /01\.05\.0079/);
});

test('a ficha do gestor mostra os dados, as inspeções e os avisos', async () => {
  stubApi(api);
  await mount('gestor', '/historico/1');

  assert.match(main(), /Elevador 01\.05\.0079/);
  assert.match(main(), /Referência interna01\.05\.0079/);
  assert.match(main(), /2024\/0611/);
  assert.match(main(), /Inspeave, Lda\./);

  await click('Ver todos os dados');
  assert.match(dialog(), /Dados do elevador 01\.05\.0079/);
  assert.match(dialog(), /900000001/);

  await click('Descarregar relatório 2024/0611');
  assert.match(dialog(), /Relatório — 2024\/0611/);

  await click('Avisos');
  assert.match(main(), /Inspeção necessária/);
  await click('Ver ofício 2');
  assert.match(dialog(), /precisa de ser inspecionado/);
});

test('o aviso simulado do gestor junta-se aos da API', async () => {
  stubApi(api);
  await mount('gestor', '/historico/1');

  await click('Enviar aviso de inspeção');
  await click('Enviar aviso');
  assert.match(main(), /Necessidade de inspeção/);
  assert.match(main(), /Inspeção necessária/);
});

test('a EMA vê os históricos em painéis, sem avisos', async () => {
  const fetch = stubApi(api);
  await mount('manutencao', '/detalhes/1');

  assert.match(main(), /Histórico de inspeções/);
  assert.match(main(), /2024\/0611/);
  assert.ok(!fetch.mock.calls.some(([url]) => String(url).endsWith('/notices')));
});

test('uma ficha que a API não encontra', async () => {
  stubApi({ ...api, '/elevators/1': 404 });
  await mount('proprietario', '/detalhes/1');

  assert.match(main(), /Elevador não encontrado/);
  await click('Voltar aos elevadores');
  assert.match(main(), /Os meus elevadores/);
});

test('uma ficha que falha mostra o erro e volta a tentar', async () => {
  let fail = true;
  stubApi({ ...api, '/elevators/1': () => (fail ? 500 : detail) });
  await mount('proprietario', '/detalhes/1');

  assert.match(main(), /Não foi possível carregar o elevador\./);
  fail = false;
  await click('Tentar de novo');
  assert.match(main(), /Elevador 01\.05\.0079/);
});

test('um histórico que falha mostra o erro dentro da tabela', async () => {
  let fail = true;
  stubApi({ ...api, '/elevators/1/inspections': () => (fail ? 500 : inspections) });
  await mount('proprietario', '/detalhes/1');

  assert.match(main(), /Não foi possível carregar o histórico\./);
  fail = false;
  await click('Tentar de novo');
  assert.match(main(), /2024\/0611/);
});

test('as reprovadas e os pedidos abrem a ficha pelo id da API', async () => {
  stubApi(api);
  const { router } = await mount('gestor', '/reprovadas');

  await click('Consultar 01.05.0231');
  assert.equal(router.state.location.pathname, '/historico/5');
});

test('a referência num pedido abre a ficha pelo id da API', async () => {
  stubApi({
    ...api,
    '/inspections/requests?open=true': [
      {
        id: 1,
        process_number: '2026/0362',
        type: 'reinspection',
        status: 'awaiting_scheduling',
        submitted_at: '2026-10-09T09:00:00',
        scheduled_at: null,
        elevator: {
          id: 5,
          internal_reference: '01.05.0231',
          address: 'Rua Eng. Von Haff 40',
          maintenance_company: { name: 'Elevar, Lda.', phone: null, email: null },
        },
        inspection_company: { name: 'Inspeave, Lda.', phone: null, email: null },
        inspection: null,
      },
    ],
  });
  const { router } = await mount('gestor', '/pedidos');

  await click('01.05.0231');
  assert.equal(router.state.location.pathname, '/historico/5');
});

const openRequest = {
  id: 9,
  process_number: '2026/0401',
  type: 'periodic',
  equipment_type: 'elevator',
  status: 'scheduled',
  submitted_at: '2026-11-16T09:12:00',
  scheduled_at: '2026-12-03T10:30:00',
  elevator: {
    id: 1,
    internal_reference: '01.05.0079',
    dge_number: 'DGE-10079',
    address: 'Rua de Viseu 12',
    maintenance_company: { name: 'Elevar, Lda.', phone: null, email: null },
  },
  inspection_company: { name: 'Inspeave, Lda.', phone: null, email: null },
  inspection: null,
};

test('o proprietário vê na ficha o pedido em curso e quando é a inspeção', async () => {
  const fetch = stubApi({
    ...api,
    '/inspections/requests?open=true&elevator_id=1': [openRequest],
  });
  await mount('proprietario', '/detalhes/1');

  assert.ok(
    fetch.mock.calls.some(([url]) => url === '/api/inspections/requests?open=true&elevator_id=1'),
  );
  assert.match(main(), /Pedidos de inspeção em curso/);
  assert.match(main(), /2026\/0401/);
  assert.match(main(), /Agendado/);
  assert.match(main(), /03\/12\/2026/);
  assert.match(main(), /10:30/);
  // O resultado oficial continua no histórico.
  assert.match(main(), /2024\/0611/);
});

test('sem pedidos em curso, a ficha remete para o histórico', async () => {
  stubApi(api);
  await mount('proprietario', '/detalhes/1');

  assert.match(main(), /Não há pedidos de inspeção em curso\./);
});

test('os pedidos em curso que falham podem ser pedidos de novo', async () => {
  let fail = true;
  stubApi({
    ...api,
    '/inspections/requests?open=true&elevator_id=1': () => (fail ? 500 : [openRequest]),
  });
  await mount('proprietario', '/detalhes/1');

  assert.match(main(), /Não foi possível carregar os pedidos de inspeção\./);
  fail = false;
  const retry = [...document.querySelectorAll('button')].filter(
    (b) => b.textContent.trim() === 'Tentar de novo',
  );
  act(() => retry.at(-1).click());
  await settle();
  assert.match(main(), /2026\/0401/);
});
