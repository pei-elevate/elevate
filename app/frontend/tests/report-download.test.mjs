// @vitest-environment jsdom
// «Descarregar relatório» (ELEV-56): o PDF vem da API, pedido em nome do perfil, e guarda-se
// com o nome que o backend indica. Monta-se a app num DOM e simula-se o fetch.
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, test, vi } from 'vitest';
import { createRoutes } from '@/app/App';
import { toInspectionRow } from '@/features/elevators/api';
import { downloadReport } from '@/features/inspections/api';
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

/** Ficheiros que a página mandou guardar: o nome e o endereço do blob. */
let saved;
beforeEach(() => {
  saved = [];
  URL.createObjectURL = vi.fn(() => 'blob:relatorio');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    saved.push({ name: this.download, href: this.href });
  });
});

let root;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const completed = {
  id: 8,
  process_number: '2026/0341',
  type: 'periodic',
  equipment_type: 'elevator',
  status: 'completed',
  submitted_at: '2026-10-02T00:00:00',
  scheduled_at: '2026-11-19T10:00:00',
  elevator: {
    id: 4,
    internal_reference: '01.05.0154',
    dge_number: 'DGE-10154',
    address: 'Av. Dr. Lourenço Peixinho 85',
    maintenance_company: { name: 'Elevar, Lda.', phone: null, email: null },
  },
  inspection_company: { name: 'Inspeave, Lda.', phone: null, email: null },
  inspection: {
    performed_date: '2026-11-19',
    result: 'approved',
    valid_until: '2028-11-19',
    correction_deadline: null,
  },
};

const pdf = () =>
  new Response(new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' }), {
    status: 200,
    headers: { 'Content-Disposition': 'attachment; filename="relatorio-2026-0341.pdf"' },
  });

/** Lista com o pedido concluído; o relatório responde com `report()`. */
function stubApi(report = pdf) {
  const fetch = vi.fn(async (url) => {
    if (/\/report$/.test(String(url))) return report();
    const lists = ['/api/inspections/assigned', '/api/inspections/requests?recent=6'];
    return new Response(JSON.stringify(lists.includes(String(url)) ? [completed] : []), {
      status: 200,
    });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const reportCalls = (fetch) => fetch.mock.calls.filter(([url]) => /\/report$/.test(String(url)));

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
}

async function clickDownload() {
  const button = [...document.querySelectorAll('main button')].find((b) =>
    b.textContent.includes('Descarregar relatório'),
  );
  assert.ok(button, 'há um botão Descarregar relatório');
  await act(async () => button.click());
  await settle();
}

test('descarregar pede o PDF em nome do perfil e guarda-o com o nome do backend', async () => {
  const fetch = stubApi();

  await downloadReport('proprietario', 8);

  const [url, init] = fetch.mock.calls[0];
  assert.equal(url, '/api/inspections/requests/8/report');
  assert.equal(init.headers['X-User-Id'], 'seed-owner');
  assert.deepEqual(saved, [{ name: 'relatorio-2026-0341.pdf', href: 'blob:relatorio' }]);
  assert.equal(URL.revokeObjectURL.mock.calls.length, 1);
});

test('um relatório que falta lança o erro da API', async () => {
  stubApi(() => new Response(JSON.stringify({ detail: 'x' }), { status: 404 }));

  await assert.rejects(downloadReport('gestor', 8), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 404);
    return true;
  });
  assert.deepEqual(saved, []);
});

test('nas inspeções atribuídas, o relatório vem da API', async () => {
  const fetch = stubApi();
  await mount('inspecao', '/atribuidas');

  await clickDownload();

  assert.deepEqual(
    reportCalls(fetch).map(([url, init]) => [url, init.headers['X-User-Id']]),
    [['/api/inspections/requests/8/report', 'seed-inspection']],
  );
  assert.deepEqual(
    saved.map((f) => f.name),
    ['relatorio-2026-0341.pdf'],
  );
  // Já não abre o relatório de demonstração.
  assert.doesNotMatch(document.body.textContent, /Documento de demonstração/);
});

test('no painel do proprietário, o relatório vem da API', async () => {
  const fetch = stubApi();
  await mount('proprietario', '/painel');

  await clickDownload();

  assert.deepEqual(
    reportCalls(fetch).map(([url, init]) => [url, init.headers['X-User-Id']]),
    [['/api/inspections/requests/8/report', 'seed-owner']],
  );
  assert.deepEqual(
    saved.map((f) => f.name),
    ['relatorio-2026-0341.pdf'],
  );
});

test('se a descarga falhar, a página avisa', async () => {
  stubApi(() => new Response('{}', { status: 500 }));
  await mount('inspecao', '/atribuidas');

  await clickDownload();

  assert.match(document.body.textContent, /Não foi possível descarregar o relatório/);
  assert.deepEqual(saved, []);
});

test('o histórico do elevador sabe de que pedido descarregar', () => {
  const row = toInspectionRow({
    request_id: 8,
    process_number: '2026/0341',
    submitted_at: '2026-10-02T00:00:00',
    type: 'periodic',
    inspection_company: { name: 'Inspeave, Lda.' },
    performed_date: '2026-11-19',
    result: 'approved',
    valid_until: '2028-11-19',
    report_file: 'x.pdf',
  });

  assert.equal(row.key, 8);
});
