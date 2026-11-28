import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { test } from 'vitest';
import { PAGE_SIZE, Pagination, pageNumbers, paginate } from '@/shared/ui/Pagination';

const list = (n) => Array.from({ length: n }, (_, i) => i + 1);

test('cada página tem no máximo PAGE_SIZE linhas', () => {
  assert.equal(PAGE_SIZE, 10);
  assert.deepEqual(paginate(list(25), 1).items, list(10));
  assert.deepEqual(paginate(list(25), 3).items, [21, 22, 23, 24, 25]);
  assert.deepEqual(paginate(list(25), 2), {
    page: 2,
    pages: 3,
    start: 10,
    total: 25,
    items: list(20).slice(10),
  });
});

test('a página é ajustada quando a lista encolhe ou está vazia', () => {
  // Estava na página 3 e o filtro deixou só 12 linhas: passa à última página.
  assert.equal(paginate(list(12), 3).page, 2);
  assert.deepEqual(paginate(list(12), 3).items, [11, 12]);
  assert.deepEqual(paginate([], 4), { page: 1, pages: 1, start: 0, total: 0, items: [] });
  assert.equal(paginate(list(5), 0).page, 1);
});

test('tamanho de página próprio', () => {
  assert.deepEqual(paginate(list(7), 2, 5).items, [6, 7]);
});

test('números das páginas, com saltos', () => {
  assert.deepEqual(pageNumbers(1, 1), [1]);
  assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbers(5, 9), [1, '…', 4, 5, 6, '…', 9]);
  assert.deepEqual(pageNumbers(1, 9), [1, 2, '…', 9]);
  assert.deepEqual(pageNumbers(9, 9), [1, '…', 8, 9]);
  assert.deepEqual(pageNumbers(3, 9), [1, 2, 3, 4, '…', 9]);
});

const render = (pagination, footer) =>
  renderToString(createElement(Pagination, { pagination, footer }));

test('a navegação só aparece com mais de uma página', () => {
  const setPage = () => {};
  assert.equal(render({ ...paginate(list(10), 1), setPage }), '');

  const html = render({ ...paginate(list(25), 2), setPage });
  assert.match(html, /aria-label="Paginação"/);
  assert.match(html, /11<!-- -->–<!-- -->20<!-- --> de <!-- -->25/);
  assert.match(html, /aria-label="Página 2" aria-current="page"/);
  assert.doesNotMatch(html, /disabled/);
});

test('Anterior e Seguinte ficam inativos nas pontas', () => {
  const setPage = () => {};
  const first = render({ ...paginate(list(25), 1), setPage });
  const last = render({ ...paginate(list(25), 3), setPage });

  assert.match(first, /aria-label="Página anterior" disabled/);
  assert.doesNotMatch(first, /aria-label="Página seguinte" disabled/);
  assert.match(last, /aria-label="Página seguinte" disabled/);
});

test('com footer, fica num rodapé próprio', () => {
  const html = render({ ...paginate(list(25), 1), setPage: () => {} }, true);
  assert.match(html, /class="panel-footer pagination-footer"/);
});
