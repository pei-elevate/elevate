import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { test } from 'vitest';
import { createRoutes } from '@/app/App';
import { ElevatorsState } from '@/features/elevators/ElevatorsState';
import { PermitsTableState, visiblePermits } from '@/features/permits/PermitsPage';
import { DataTable, hasOverflow } from '@/shared/ui/DataTable';

// Caminhos relativos a este ficheiro, para a pasta do frontend poder mudar de sítio.
const root = new URL('../', import.meta.url);

test('ecrãs e rotas do protótipo', async () => {
  const screens = [
    ['proprietario', '/painel', 'Painel geral'],
    ['proprietario', '/detalhes/1', 'A carregar elevador…'],
    ['proprietario', '/avisos', 'Página não encontrada'],
    ['manutencao', '/elevadores', 'Painel geral'],
    ['manutencao', '/detalhes/1', 'A carregar elevador…'],
    ['manutencao', '/inspecoes', 'Inspeções'],
    ['manutencao', '/registar', 'Registar elevador'],
    ['manutencao', '/reprovadas', 'Inspeções reprovadas'],
    ['manutencao', '/reclamacoes', 'Reclamações'],
    ['manutencao', '/reclamacao', 'Registar reclamação'],
    ['urbanismo', '/novo-aviso', 'Registar novo alvará'],
    ['gestor', '/painel', 'Painel geral'],
    ['gestor', '/cadastro', 'Elevadores registados'],
    ['gestor', '/historico/1', 'A carregar elevador…'],
    ['gestor', '/nao-registados', 'Elevadores não registados'],
    ['gestor', '/validacoes', 'Validar registo'],
    ['gestor', '/pedidos', 'Pedidos de inspeção'],
    ['gestor', '/reprovadas', 'Inspeções reprovadas'],
    ['inspecao', '/atribuidas', 'Inspeções atribuídas'],
    ['inspecao', '/agendar/2026%2F0377', 'Agendar inspeção'],
    ['inspecao', '/resultado/2026%2F0341', 'Submeter resultado da inspeção'],
    ['inspecao', '/agendar/2026%2F0341', 'Reagendar inspeção'],
    ['urbanismo', '/avisos', 'Alvarás registados'],
    ['inspecao', '/agendar', 'Agendar inspeções'],
    ['inspecao', '/concluidas', 'Página não encontrada'],
    ['gestor', '/xyz', 'Página não encontrada'],
    ['proprietario', '/', 'Painel geral'],
    ['proprietario', '/detalhes/%ZZ', 'Elevador não encontrado'],
  ];
  const images = new Set();
  for (const [role, path, title] of screens) {
    const route = role + path;
    const router = createMemoryRouter(createRoutes(role), { initialEntries: [path] });
    const html = renderToString(createElement(RouterProvider, { router }));
    assert.match(html, new RegExp(title), route);
    assert.equal(
      (html.match(/<h1[ >]/g) || []).length,
      1,
      `${route} deve ter um único título principal`,
    );
    assert.doesNotMatch(
      html,
      />\s*(Dashboard|Submit|Cancel|Sign out|Failed|Choose file)\s*</,
      `${route} deve estar em português`,
    );
    assert.match(html, /Navegação principal/, route);
    if (route === 'manutencao/reclamacoes') {
      assert.doesNotMatch(html, /Todas as reclamações/);
      assert.match(html, /Registar nova reclamação/);
      assert.doesNotMatch(html, /Reclamações recentes/);
    }
    if (route === 'manutencao/reclamacao') {
      assert.match(html, /01.05.0079 — Rua de Viseu 12/);
      assert.doesNotMatch(html, /Reclamações recentes/);
    }
    for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/g)) images.add(match[1]);
  }
  for (const image of images) {
    assert.ok(
      (await stat(new URL(`public${image}`, root))).size > 0,
      `Recurso local vazio: ${image}`,
    );
  }
  assert.match(await readFile(new URL('index.html', root), 'utf8'), /lang="pt-PT"/);
  console.log(
    `${screens.length} ecrãs e rotas renderizados; recursos locais e estrutura em português: OK`,
  );
});

test('a região da tabela só recebe foco do teclado quando tem scroll', () => {
  assert.equal(hasOverflow({ scrollWidth: 900, clientWidth: 600 }), true);
  assert.equal(hasOverflow({ scrollWidth: 600, clientWidth: 600 }), false);
  // Antes de medir (render inicial), a região não é uma paragem de Tab.
  const html = renderToString(createElement(DataTable, { headers: ['A'] }, null));
  assert.match(html, /role="region"/);
  assert.doesNotMatch(html, /tabindex/i);
});

const permit = (id, status) => ({
  id,
  permit_number: `${id}/2026`,
  permit_date: '2026-09-11',
  address: 'Rua de Viseu 30',
  num_elevators: 1,
  postal_code: '3810-000',
  parish: 'Glória e Vera Cruz',
  owner_name: 'Condomínio Viseu 30',
  registered: status === 'registered' ? 1 : 0,
  pending: status === 'pending' ? 1 : 0,
  missing: status === 'missing' ? 1 : 0,
  status,
  last_alert_at: null,
});

test('alvarás visíveis por perfil e separador', () => {
  const all = [permit(1, 'missing'), permit(2, 'pending'), permit(3, 'registered')];
  const ids = (items) => items.map((p) => p.id);

  assert.deepEqual(ids(visiblePermits(all, 'Todos', true)), [1, 2, 3]);
  assert.deepEqual(
    ids(visiblePermits(all, 'Todos', false)),
    [1, 2],
    'o gestor não vê os registados',
  );
  assert.deepEqual(ids(visiblePermits(all, 'Por registar', false)), [1]);
  assert.deepEqual(ids(visiblePermits(all, 'Por validar', true)), [2]);
  assert.deepEqual(ids(visiblePermits(all, 'Registado', true)), [3]);
});

test('a lista de alvarás mostra o erro de carregamento em vez de uma lista vazia', () => {
  const html = renderToString(
    createElement(PermitsTableState, { permits: null, error: true, onRetry: () => {} }, 'tabela'),
  );

  assert.match(html, /Não foi possível carregar os alvarás\./);
  assert.match(html, /Tentar novamente/);
  assert.doesNotMatch(html, /tabela|Sem resultados/);
});

test('a lista de alvarás indica que está a carregar', () => {
  const html = renderToString(
    createElement(PermitsTableState, { permits: null, error: false, onRetry: () => {} }, 'tabela'),
  );

  assert.match(html, /A carregar alvarás…/);
  assert.doesNotMatch(html, /tabela/);
  assert.match(
    renderToString(
      createElement(PermitsTableState, { permits: [], error: false, onRetry: () => {} }, 'tabela'),
    ),
    /tabela/,
  );
});

test('a lista de elevadores mostra o estado de carregamento e de erro', () => {
  const loading = renderToString(createElement(ElevatorsState, { error: false, onRetry() {} }));
  assert.match(loading, /A carregar elevadores…/);
  assert.doesNotMatch(loading, /Tentar de novo/);

  const failed = renderToString(createElement(ElevatorsState, { error: true, onRetry() {} }));
  assert.match(failed, /Não foi possível carregar os elevadores\./);
  assert.match(failed, /Tentar de novo/);
});
