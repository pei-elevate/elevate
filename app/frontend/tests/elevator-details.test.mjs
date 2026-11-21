import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { test } from 'vitest';
import { createRoutes } from '@/app/App';
import { elevatorDataModal } from '@/features/elevators/elevatorDataModal';
import { toElevator } from '@/features/elevators/api';
import { noticeModal } from '@/features/notices/noticeModal';

function apiElevator(fields = {}) {
  return {
    id: 1,
    internal_reference: '01.05.0079',
    dge_number: 'DGE-10079',
    address: 'Rua de Viseu 12',
    postal_code: '3810-000',
    parish: 'Glória e Vera Cruz',
    building: null,
    owner: {
      id: 1,
      type: 'condominium',
      name: 'Condomínio Edifício Ria',
      nif: '900000001',
      email: 'ria@exemplo.pt',
      phone: null,
    },
    maintenance_company: { name: 'Elevar, Lda.', email: 'geral@elevar.pt', phone: '234000001' },
    inspection_company: { name: 'Inspeave, Lda.', email: null, phone: null },
    certificate_status: 'valid',
    valid_until: '2027-03-03',
    latest_request: null,
    equipment_type: 'goods_lift',
    service_date: '2015-01-01',
    created_at: '2026-01-10T10:00:00',
    last_inspection: { performed_date: '2025-03-03', result: 'approved' },
    permit: {
      id: 3,
      permit_number: '104/2026',
      permit_date: '2026-09-24',
      address: 'Rua de Viseu 12',
      num_elevators: 1,
    },
    ...fields,
  };
}

function render(role, path) {
  const router = createMemoryRouter(createRoutes(role), { initialEntries: [path] });
  return renderToString(createElement(RouterProvider, { router }));
}

test('o modal mostra todos os dados agrupados', () => {
  const modal = elevatorDataModal(apiElevator(), 'gestor');
  const html = renderToString(modal.body);

  assert.equal(modal.title, 'Dados do elevador 01.05.0079');
  for (const text of [
    'Elevador',
    'Proprietário',
    'Manutenção',
    'Inspeção',
    'Registo',
    'Monta-cargas',
    'DGE-10079',
    'Condomínio',
    '900000001',
    'geral@elevar.pt',
    'Inspeave, Lda.',
    'Aprovada',
    '03/03/2027',
    'Alvará',
    '104/2026 · 24/09/2026',
  ])
    assert.match(html, new RegExp(text), text);
});

test('sem alvará, o modal não mostra a linha do alvará', () => {
  const html = renderToString(
    elevatorDataModal(apiElevator({ permit: null }), 'proprietario').body,
  );
  assert.doesNotMatch(html, /Alvará/);
});

test('sem empresa de inspeção nem inspeções, o modal mostra traços', () => {
  const html = renderToString(
    elevatorDataModal(
      apiElevator({ inspection_company: null, last_inspection: null, valid_until: null }),
      'gestor',
    ).body,
  );
  assert.match(html, /Por atribuir/);
  assert.match(html, /<dt>Resultado<\/dt><dd>—<\/dd>/);
});

test('o ofício usa o corpo guardado', () => {
  const elevator = toElevator(apiElevator());
  const notice = {
    id: '7',
    elevator: '01.05.0079',
    date: '2026-11-02',
    type: 'Automático',
    subject: 'Assunto guardado',
    recipients: 'Condomínio Edifício Ria',
    body: 'Texto enviado',
  };
  const html = renderToString(noticeModal(elevator, notice).body);
  assert.match(html, /Texto enviado/);
  assert.match(html, /Assunto guardado/);
});

test('o ofício simulado mantém o texto do modelo', () => {
  const elevator = toElevator(apiElevator());
  const notice = {
    id: 'AV-001',
    elevator: '01.05.0079',
    date: '2026-11-02',
    type: 'Manual',
    subject: 'Necessidade de inspeção',
    recipients: 'Condomínio Edifício Ria',
  };
  assert.match(renderToString(noticeModal(elevator, notice).body), /identificou a necessidade/);
});

test('um id não numérico mostra elevador não encontrado', () => {
  assert.match(render('gestor', '/historico/abc'), /Elevador não encontrado/);
  assert.match(render('proprietario', '/detalhes/01.05.0079'), /Elevador não encontrado/);
});

test('enquanto a ficha carrega, o título diz que está a carregar', () => {
  assert.match(render('gestor', '/historico/1'), /A carregar elevador…/);
});

test('a ficha abre-se pelo id da API a partir da referência', async () => {
  const { detailId } = await import('@/features/elevators/links');
  const items = [{ id: '01.05.0079', key: 12 }];
  assert.equal(detailId('01.05.0079', items), '12');
  // Sem correspondência (ou antes de a lista carregar), fica a referência.
  assert.equal(detailId('01.05.0999', items), '01.05.0999');
  assert.equal(detailId('01.05.0079', null), '01.05.0079');
});

test('a empresa de inspeção vê a referência sem ligação para a ficha', () => {
  // Este perfil não consulta elevadores (a API dá 403): a ligação acabava em «não encontrado».
  const html = render('inspecao', '/agendar');
  assert.match(html, /01\.05\.0203/);
  assert.doesNotMatch(html, /<button[^>]*>01\.05\.0203</);
});
