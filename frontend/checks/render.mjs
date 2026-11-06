import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { build } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
await build({
  logLevel: 'warn',
  build: {
    ssr: 'src/App.tsx',
    outDir: 'node_modules/.cache/elevate-ssr',
    emptyOutDir: true,
    minify: false,
  },
});
const { default: App } = await import('../node_modules/.cache/elevate-ssr/App.js');
const screens = [
  ['proprietario/painel', 'Painel geral'],
  ['proprietario/detalhes/01.05.0079', 'Elevador 01.05.0079'],
  ['proprietario/avisos', 'Página não encontrada'],
  ['manutencao/elevadores', 'Painel geral'],
  ['manutencao/detalhes/01.05.0079', 'Elevador 01.05.0079'],
  ['manutencao/inspecoes', 'Inspeções'],
  ['manutencao/registar', 'Registar elevador'],
  ['manutencao/reprovadas', 'Inspeções reprovadas'],
  ['manutencao/reclamacoes', 'Reclamações'],
  ['manutencao/reclamacao', 'Registar reclamação'],
  ['urbanismo/novo-aviso', 'Registar novo alvará'],
  ['gestor/painel', 'Painel geral'],
  ['gestor/cadastro', 'Elevadores registados'],
  ['gestor/historico/01.05.0079', 'Elevador 01.05.0079'],
  ['gestor/nao-registados', 'Elevadores não registados'],
  ['gestor/validacoes', 'Validar registo'],
  ['gestor/pedidos', 'Pedidos de inspeção'],
  ['gestor/reprovadas', 'Inspeções reprovadas'],
  ['inspecao/atribuidas', 'Inspeções atribuídas'],
  ['inspecao/agendar/2026%2F0377', 'Agendar inspeção'],
  ['inspecao/resultado/2026%2F0341', 'Submeter resultado da inspeção'],
  ['inspecao/agendar/2026%2F0341', 'Reagendar inspeção'],
  ['urbanismo/avisos', 'Alvarás registados'],
  ['inspecao/agendar', 'Agendar inspeções'],
  ['inspecao/concluidas', 'Página não encontrada'],
  ['gestor/xyz', 'Página não encontrada'],
  ['constructor/painel', 'Painel geral'],
  ['proprietario/detalhes/%ZZ', 'Elevador não encontrado'],
];
const images = new Set();
for (const [route, title] of screens) {
  globalThis.window = { location: { hash: '#' + route } };
  const html = renderToString(createElement(App));
  assert.match(html, new RegExp(title), route);
  assert.equal(
    (html.match(/<h1[ >]/g) || []).length,
    1,
    route + ' deve ter um único título principal',
  );
  assert.doesNotMatch(
    html,
    />\s*(Dashboard|Submit|Cancel|Sign out|Failed|Choose file)\s*</,
    route + ' deve estar em português',
  );
  assert.match(html, /Navegação principal/, route);
  if (route === 'gestor/historico/01.05.0079') {
    for (const text of ['Enviar aviso de inspeção', 'Inspeções', 'Avisos', 'Reclamações'])
      assert.match(html, new RegExp(`>${text}<`), route);
    assert.match(html, /Descarregar relatório/, route);
    assert.doesNotMatch(html, /Cronologia|Histórico de avisos|Histórico de reclamações/, route);
  }
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
  assert.ok((await stat('public' + image)).size > 0, 'Recurso local vazio: ' + image);
}
assert.match(await readFile('index.html', 'utf8'), /lang="pt-PT"/);
console.log(
  `${screens.length} ecrãs e rotas renderizados; recursos locais e estrutura em português: OK`,
);
