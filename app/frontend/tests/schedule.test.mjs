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
import { validateSchedule } from '@/features/inspections/validation';
import { maskDate, maskTime } from '@/shared/lib/dates';

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

/** Responde aos pedidos atribuídos com `answer` (lista ou código de erro) e ao agendamento com
 * `scheduled` (código de resposta); o resto, vazio. */
function stubApi(answer, scheduled = () => 200) {
  const fetch = vi.fn(async (url, init = {}) => {
    const json = (status, body) => new Response(JSON.stringify(body), { status });

    if (init.method === 'POST' && /\/schedule$/.test(String(url))) {
      const status = scheduled();
      return status < 300 ? json(status, apiRequest({ status: 'scheduled' })) : json(status, {});
    }
    const value = String(url) === '/api/inspections/assigned' ? answer() : [];
    return typeof value === 'number' ? json(value, {}) : json(200, value);
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
const page = () => document.body.textContent;

/** Espera até `check` deixar de falhar (a gravação espera um pouco e vai à API). */
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

/** Escreve num campo como o utilizador, para o React ver a alteração. */
function type(name, value) {
  const input = document.querySelector(`[name="${name}"]`);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function scheduleFor(date, time) {
  await act(async () => {
    type('date', date);
    type('time', time);
  });
  await act(async () => {
    document.querySelector('main form').requestSubmit();
  });
}
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

test('agendar grava na API e o pedido sai da lista', async () => {
  let list = assigned;
  const fetch = stubApi(() => list);
  const router = await mount('inspecao', '/agendar/2026%2F0401');

  // Um pedido vindo do MyDoc abre o formulário, com os dados da API.
  assert.match(main(), /Agendar inspeção/);
  assert.match(main(), /Rua João Mendonça 5/);

  list = assigned.map((r) =>
    r.id === 9 ? { ...r, status: 'scheduled', scheduled_at: '2030-12-02T10:00:00' } : r,
  );
  await scheduleFor('02/12/2030', '10:00');

  await until(() => assert.equal(router.state.location.pathname, '/agendar'));
  const [[url, init]] = posts(fetch);
  assert.equal(url, '/api/inspections/requests/9/schedule');
  assert.deepEqual(JSON.parse(init.body), { scheduled_at: '2030-12-02T10:00' });
  assert.match(page(), /Inspeção agendada/);
  // A lista volta a ser pedida e o pedido agendado já não está por agendar.
  await until(() => assert.doesNotMatch(main(), /2026\/0401/));
  assert.equal(badge('Agendar inspeções'), '1');
});

test('um 409 deixa o formulário aberto com a mensagem', async () => {
  const fetch = stubApi(
    () => assigned,
    () => 409,
  );
  const router = await mount('inspecao', '/agendar/2026%2F0401');

  await scheduleFor('02/12/2030', '10:00');

  await until(() =>
    assert.match(
      document.querySelector('[role="alert"]')?.textContent ?? '',
      /Este pedido já foi agendado ou concluído\. Atualize a lista\./,
    ),
  );
  assert.equal(posts(fetch).length, 1);
  assert.equal(router.state.location.pathname, '/agendar/2026%2F0401');
});

test('uma data no passado não chega à API', async () => {
  const fetch = stubApi(() => assigned);
  await mount('inspecao', '/agendar/2026%2F0401');

  await scheduleFor('01/01/2020', '10:00');

  assert.match(main(), /Escolha a data de hoje ou uma data futura/);
  assert.equal(posts(fetch).length, 0);
});

test('um pedido já agendado não abre o formulário', async () => {
  stubApi(() => assigned);
  await mount('inspecao', '/agendar/2026%2F0341');

  assert.match(main(), /Ação indisponível/);
  assert.equal(document.querySelector('main form'), null);
});

test('o formulário não mostra dados do proprietário', async () => {
  // A API não dá à empresa de inspeção dados do proprietário (decisão D1).
  stubApi(() => assigned);
  await mount('inspecao', '/agendar/2026%2F0401');

  assert.doesNotMatch(main(), /Válido até/);
  assert.match(main(), /Proprietário do elevador/);
  assert.match(main(), /Elevar, Lda\. — manutenção/);
});

test('as inspeções atribuídas não oferecem reagendar', async () => {
  stubApi(() => assigned);
  await mount('inspecao', '/atribuidas');

  assert.match(main(), /2026\/0341/);
  const buttons = [...document.querySelectorAll('main button')].map((b) => b.textContent);
  assert.ok(!buttons.includes('Reagendar'));
  assert.ok(buttons.includes('Submeter resultado'));
});

test('a data ganha as barras enquanto se escrevem os números', () => {
  assert.equal(maskDate('1'), '1');
  assert.equal(maskDate('15'), '15');
  assert.equal(maskDate('151'), '15/1');
  assert.equal(maskDate('1512'), '15/12');
  assert.equal(maskDate('15122'), '15/12/2');
  assert.equal(maskDate('15122030'), '15/12/2030');
  // Já com barras (colado ou escrito à mão), fica igual.
  assert.equal(maskDate('15/12/2030'), '15/12/2030');
  // Apagar a barra apaga-a mesmo, em vez de ela voltar logo.
  assert.equal(maskDate('15/'), '15');
  // Letras e números a mais ficam de fora.
  assert.equal(maskDate('15a12b2030'), '15/12/2030');
  assert.equal(maskDate('151220301'), '15/12/2030');
  assert.equal(maskDate(''), '');
});

test('no formulário basta escrever os números da data', async () => {
  const fetch = stubApi(() => assigned);
  await mount('inspecao', '/agendar/2026%2F0401');

  await scheduleFor('02122030', '10:00');

  const input = document.querySelector('[name="date"]');
  assert.equal(input.inputMode, 'numeric');
  await until(() => assert.equal(posts(fetch).length, 1));
  assert.deepEqual(JSON.parse(posts(fetch)[0][1].body), { scheduled_at: '2030-12-02T10:00' });
});

test('a hora ganha os dois pontos enquanto se escrevem os números', () => {
  assert.equal(maskTime('1'), '1');
  assert.equal(maskTime('14'), '14');
  assert.equal(maskTime('143'), '14:3');
  assert.equal(maskTime('1430'), '14:30');
  assert.equal(maskTime('14:30'), '14:30');
  // Apagar os dois pontos apaga-os mesmo.
  assert.equal(maskTime('14:'), '14');
  assert.equal(maskTime('14h30'), '14:30');
  assert.equal(maskTime('14305'), '14:30');
  assert.equal(maskTime(''), '');
});

test('uma hora inválida não passa a validação', () => {
  const ok = { date: '2030-12-02', time: '14:30' };
  assert.equal(validateSchedule(ok, null, '2026-11-24').time, undefined);
  for (const time of ['25:00', '14:60', '9:30', '14'])
    assert.equal(
      validateSchedule({ ...ok, time }, null, '2026-11-24').time,
      'Indique uma hora válida no formato HH:MM.',
      time,
    );
});

test('no formulário basta escrever os números da hora', async () => {
  const fetch = stubApi(() => assigned);
  await mount('inspecao', '/agendar/2026%2F0401');

  await scheduleFor('02122030', '1430');

  const input = document.querySelector('[name="time"]');
  assert.equal(input.type, 'text');
  assert.equal(input.inputMode, 'numeric');
  await until(() => assert.equal(posts(fetch).length, 1));
  assert.deepEqual(JSON.parse(posts(fetch)[0][1].body), { scheduled_at: '2030-12-02T14:30' });
});
