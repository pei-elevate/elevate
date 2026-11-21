import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import {
  getElevator,
  listElevatorInspections,
  listElevatorNotices,
  listElevators,
  load,
  toElevator,
  toInspectionRow,
  toNotice,
} from '@/features/elevators/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body = []) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function apiSummary(fields = {}) {
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

test('a lista é pedida em nome do perfil', async () => {
  const fetch = stubFetch();

  await listElevators('proprietario');

  const [url, init] = fetch.mock.calls[0];
  assert.equal(url, '/api/elevators');
  assert.equal(init.headers['X-User-Id'], 'seed-owner');
});

test('a ficha e os históricos são pedidos pelo id', async () => {
  const fetch = stubFetch();

  await getElevator('gestor', 12);
  await listElevatorInspections('gestor', 12);
  await listElevatorNotices('gestor', 12);

  assert.deepEqual(
    fetch.mock.calls.map(([url]) => url),
    ['/api/elevators/12', '/api/elevators/12/inspections', '/api/elevators/12/notices'],
  );
});

test('um elevador fica no formato da tabela', () => {
  assert.deepEqual(toElevator(apiSummary()), {
    id: '01.05.0079',
    key: 1,
    dge: 'DGE-10079',
    owner: 'Condomínio Edifício Ria',
    address: 'Rua de Viseu 12',
    parish: 'Glória e Vera Cruz',
    company: 'Elevar, Lda.',
    inspector: 'Inspeave, Lda.',
    validUntil: '2026-12-12',
    status: 'A vencer',
    entry: '2024/0611',
    entryDate: '2024-10-02',
    scope: 'Inspeção',
  });
});

test('sem empresa de inspeção, DGE nem pedidos', () => {
  const e = toElevator(
    apiSummary({
      inspection_company: null,
      dge_number: null,
      latest_request: null,
      certificate_status: 'not_inspected',
      valid_until: null,
    }),
  );
  assert.equal(e.inspector, 'Por atribuir');
  assert.equal(e.dge, '—');
  assert.equal(e.entry, '—');
  assert.equal(e.scope, '—');
  assert.equal(e.entryDate, '');
  assert.equal(e.validUntil, '');
  assert.equal(e.status, 'Por inspecionar');
});

test('estados do certificado em português', () => {
  const status = (s) => toElevator(apiSummary({ certificate_status: s })).status;
  assert.equal(status('valid'), 'Válida');
  assert.equal(status('overdue'), 'Em atraso');
  assert.equal(status('failed'), 'Reprovada');
});

test('uma inspeção fica no formato do histórico', () => {
  assert.deepEqual(
    toInspectionRow({
      process_number: '2025/0118',
      submitted_at: '2025-01-14T00:00:00',
      type: 'reinspection',
      inspection_company: { name: 'Inspeave, Lda.' },
      performed_date: '2025-03-03',
      result: 'failed',
      valid_until: null,
      report_file: 'relatorio.pdf',
    }),
    {
      entry: '2025/0118',
      date: '2025-01-14',
      scope: 'Reinspeção',
      inspector: 'Inspeave, Lda.',
      performed: '2025-03-03',
      result: 'Reprovada',
    },
  );
});

test('um aviso da API fica com o corpo e o tipo em português', () => {
  const notice = {
    id: 7,
    type: 'inspection_required',
    subject: 'Inspeção necessária',
    body: 'Texto enviado',
    recipients: 'Condomínio Edifício Ria <ria@exemplo.pt>',
    created_at: '2026-11-02T11:30:00',
  };
  assert.deepEqual(toNotice(notice, '01.05.0079'), {
    id: '7',
    elevator: '01.05.0079',
    date: '2026-11-02',
    type: 'Manual',
    subject: 'Inspeção necessária',
    recipients: 'Condomínio Edifício Ria <ria@exemplo.pt>',
    body: 'Texto enviado',
  });
  assert.equal(toNotice({ ...notice, type: 'inspection_due' }, '01.05.0079').type, 'Automático');
});

test('uma resposta depois de cancelar não é entregue', async () => {
  let resolve;
  const loaded = vi.fn();
  const failed = vi.fn();
  const cancel = load(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    loaded,
    failed,
  );

  cancel();
  resolve([1]);
  await new Promise((r) => setTimeout(r));

  assert.equal(loaded.mock.calls.length, 0);
  assert.equal(failed.mock.calls.length, 0);
});

test('um erro chega ao onError, com o erro', async () => {
  const error = new Error('falhou');
  const failed = vi.fn();
  load(() => Promise.reject(error), vi.fn(), failed);
  await new Promise((r) => setTimeout(r));

  assert.deepEqual(failed.mock.calls, [[error]]);
});
