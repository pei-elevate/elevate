import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { listAssignedRequests, loadAssignedRequests, toRequest } from '@/features/inspections/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

function apiRequest(fields = {}) {
  return {
    id: 1,
    process_number: '2026/0341',
    type: 'periodic',
    status: 'scheduled',
    submitted_at: '2026-10-02T09:15:00',
    scheduled_at: '2026-11-19T10:00:00',
    elevator: {
      internal_reference: '01.05.0154',
      address: 'Avenida Lourenço Peixinho 50',
      maintenance_company: { name: 'Elevar, Lda.', phone: '234000000', email: null },
    },
    inspection: null,
    ...fields,
  };
}

test('os pedidos atribuídos são pedidos em nome da empresa de inspeção', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify([apiRequest()]), { status: 200 }));
  vi.stubGlobal('fetch', fetch);

  const items = await listAssignedRequests('inspecao');

  assert.equal(items.length, 1);
  const [url, init] = fetch.mock.calls[0];
  assert.equal(url, '/api/inspections/assigned');
  assert.equal(init.headers['X-User-Id'], 'seed-inspection');
});

test('um pedido agendado fica no formato da tabela', () => {
  assert.deepEqual(toRequest(apiRequest()), {
    id: '2026/0341',
    key: 1,
    elevator: '01.05.0154',
    dge: '—',
    date: '2026-10-02',
    scope: 'Inspeção',
    status: 'Agendado',
    scheduled: '2026-11-19T10:00',
    result: '',
    performed: undefined,
    address: 'Avenida Lourenço Peixinho 50',
    company: 'Elevar, Lda.',
  });
});

test('estados e âmbitos em português', () => {
  assert.equal(toRequest(apiRequest({ status: 'awaiting_scheduling' })).status, 'Por agendar');
  assert.equal(toRequest(apiRequest({ status: 'completed' })).status, 'Concluído');
  assert.equal(toRequest(apiRequest({ type: 'reinspection' })).scope, 'Reinspeção');
  assert.equal(toRequest(apiRequest({ type: 'extraordinary' })).scope, 'Inspeção extraordinária');
});

test('um pedido por agendar não tem data da inspeção', () => {
  const request = toRequest(apiRequest({ status: 'awaiting_scheduling', scheduled_at: null }));

  assert.equal(request.scheduled, '');
});

test('um pedido concluído traz o resultado', () => {
  const approved = toRequest(
    apiRequest({
      status: 'completed',
      inspection: { performed_date: '2025-03-03', result: 'approved' },
    }),
  );
  const failed = toRequest(
    apiRequest({
      status: 'completed',
      inspection: { performed_date: '2026-09-18', result: 'failed' },
    }),
  );

  assert.equal(approved.result, 'Aprovada');
  assert.equal(approved.performed, '2025-03-03');
  assert.equal(failed.result, 'Reprovada');
});

test('um elevador ainda sem referência interna', () => {
  const request = toRequest(
    apiRequest({ elevator: { ...apiRequest().elevator, internal_reference: null } }),
  );

  assert.equal(request.elevator, '');
});

test('a carga entrega os pedidos já convertidos', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([apiRequest()]), { status: 200 })),
  );
  const onLoad = vi.fn();
  const onError = vi.fn();

  loadAssignedRequests('inspecao', onLoad, onError);

  await vi.waitFor(() => assert.equal(onLoad.mock.calls.length, 1));
  assert.equal(onLoad.mock.calls[0][0][0].status, 'Agendado');
  assert.equal(onError.mock.calls.length, 0);
});

test('a carga avisa quando a API falha', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 500 })),
  );
  const onLoad = vi.fn();
  const onError = vi.fn();

  loadAssignedRequests('inspecao', onLoad, onError);

  await vi.waitFor(() => assert.equal(onError.mock.calls.length, 1));
  assert.equal(onLoad.mock.calls.length, 0);
});

test('uma carga cancelada já não entrega nada', async () => {
  let respond;
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise((resolve) => (respond = resolve))),
  );
  const onLoad = vi.fn();
  const onError = vi.fn();

  const cancel = loadAssignedRequests('inspecao', onLoad, onError);
  cancel();
  respond(new Response(JSON.stringify([apiRequest()]), { status: 200 }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(onLoad.mock.calls.length, 0);
  assert.equal(onError.mock.calls.length, 0);
});
