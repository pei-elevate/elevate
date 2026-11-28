// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { createRoutes } from '@/app/App';

// A paginação num ecrã real: a lista de alvarás do Urbanismo, com a API simulada.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let container;

beforeEach(() => {
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

// 25 alvarás: os 1–20 por registar e os 21–25 já registados.
const permits = Array.from({ length: 25 }, (_, i) => {
  const n = i + 1;
  const status = n > 20 ? 'registered' : 'missing';

  return {
    id: n,
    permit_number: `${String(n).padStart(3, '0')}/2026`,
    permit_date: '2026-09-11',
    address: `Rua Alvará ${n}`,
    num_elevators: 1,
    postal_code: '3810-000',
    parish: 'Esgueira',
    owner_name: `Condomínio ${n}`,
    registered: status === 'registered' ? 1 : 0,
    pending: 0,
    missing: status === 'missing' ? 1 : 0,
    status,
    last_alert_at: null,
  };
});

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const body = url === '/api/permits' ? permits : [];
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

async function mount(role, path) {
  const router = createMemoryRouter(createRoutes(role), { initialEntries: [path] });
  await act(async () => {
    root = createRoot(container);
    root.render(createElement(RouterProvider, { router }));
  });
}

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

const rows = () =>
  [...container.querySelectorAll('main tbody tr')].map(
    (tr) => tr.querySelector('strong')?.textContent,
  );
const nav = () => container.querySelector('nav[aria-label="Paginação"]');

async function click(element) {
  await act(async () => element.click());
}

function button(label, scope = container) {
  const found = [...scope.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === label || b.getAttribute('aria-label') === label,
  );
  assert.ok(found, `botão «${label}» em falta`);
  return found;
}

test('a lista mostra 10 alvarás por página e muda de página', async () => {
  stubApi();
  await mount('urbanismo', '/avisos');
  await until(() => assert.equal(rows().length, 10));

  assert.deepEqual(
    rows(),
    Array.from({ length: 10 }, (_, i) => `Rua Alvará ${i + 1}`),
  );
  assert.match(nav().textContent, /1–10 de 25/);
  assert.ok(button('Página anterior', nav()).disabled);

  await click(button('Página seguinte', nav()));
  assert.equal(rows()[0], 'Rua Alvará 11');
  assert.match(nav().textContent, /11–20 de 25/);

  await click(button('3', nav()));
  assert.deepEqual(rows(), [
    'Rua Alvará 21',
    'Rua Alvará 22',
    'Rua Alvará 23',
    'Rua Alvará 24',
    'Rua Alvará 25',
  ]);
  assert.ok(button('Página seguinte', nav()).disabled);
});

test('mudar de separador volta à primeira página, e uma página só não tem navegação', async () => {
  stubApi();
  await mount('urbanismo', '/avisos');
  await until(() => assert.equal(rows().length, 10));
  await click(button('Página seguinte', nav()));
  assert.equal(rows()[0], 'Rua Alvará 11');

  // «Por registar»: 20 alvarás, de volta à página 1.
  await click(button('Por registar'));
  assert.equal(rows()[0], 'Rua Alvará 1');
  assert.match(nav().textContent, /1–10 de 20/);

  // «Registado»: só 5, cabem numa página.
  await click(button('Registado'));
  assert.equal(rows().length, 5);
  assert.equal(nav(), null);
});
