import assert from 'node:assert/strict';
import { test } from 'vitest';
import * as authRoles from '@/shared/auth/roles';
import * as appNavigation from '@/app/navigation';
import * as libDates from '@/shared/lib/dates';
import * as libText from '@/shared/lib/text';
import { validateComplaint } from '@/features/complaints/validation';
import { validateRegistration } from '@/features/elevators/validation';
import { validateResult, validateSchedule } from '@/features/inspections/validation';
import { validatePermit } from '@/features/permits/validation';
import * as elevatorsMocks from '@/features/elevators/mocks';
import * as elevatorsRules from '@/features/elevators/rules';
import * as inspectionsMocks from '@/features/inspections/mocks';
import * as inspectionsRules from '@/features/inspections/rules';
import * as complaintsMocks from '@/features/complaints/mocks';
import * as complaintsRules from '@/features/complaints/rules';
import * as permitsMocks from '@/features/permits/mocks';
import * as permitsRules from '@/features/permits/rules';
import * as noticesMocks from '@/features/notices/mocks';
import * as noticesRules from '@/features/notices/rules';

// Cada formulário tem o seu validador; o mapa mantém as asserções iguais às do protótipo.
const validators = {
  registar: validateRegistration,
  'novo-aviso': validatePermit,
  reclamacao: validateComplaint,
  agendar: validateSchedule,
  resultado: validateResult,
};

// Junta os módulos num só objeto para as asserções ficarem iguais às do protótipo.
const data = {
  validateSubmission: (kind, ...args) => validators[kind](...args),
  ...authRoles,
  ...appNavigation,
  ...libDates,
  ...libText,
  ...elevatorsMocks,
  ...elevatorsRules,
  ...inspectionsMocks,
  ...inspectionsRules,
  ...complaintsMocks,
  ...complaintsRules,
  ...permitsMocks,
  ...permitsRules,
  ...noticesMocks,
  ...noticesRules,
};

test('regras do protótipo', () => {
  assert.equal(
    typeof data.validateSubmission,
    'function',
    'Os formulários devem validar os dados antes de alterar o protótipo',
  );
  assert.equal(typeof data.filterElevators, 'function');
  assert.equal(
    data.validateSubmission(
      'registar',
      { address: ' ', postal: '3800', nif: '123', email: 'errado', owner: '', parish: '' },
      null,
    ).address,
    'Indique a morada.',
  );
  assert.ok(
    data.validateSubmission(
      'registar',
      {
        address: 'Rua A',
        postal: '3800-000',
        nif: '123',
        email: 'errado',
        owner: 'Condomínio',
        parish: 'Esgueira',
      },
      null,
    ).nif,
  );
  assert.deepEqual(
    data.validateSubmission(
      'reclamacao',
      {
        elevator: '01.05.0079',
        received: '2026-10-19',
        description: 'A porta não fecha.',
        status: 'Aberta',
      },
      null,
    ),
    {},
  );
  assert.ok(
    data.validateSubmission(
      'resultado',
      { result: 'Reprovada', nonconformities: '', performed: '2026-10-18' },
      { name: 'relatorio.pdf', type: 'application/pdf', size: 100 },
    ).nonconformities,
  );
  assert.ok(
    data.validateSubmission(
      'resultado',
      { result: 'Aprovada', performed: '2026-10-18' },
      { name: 'relatorio.pdf', type: 'application/pdf', size: 10485761 },
    ).document,
  );
  assert.ok(
    data.validateSubmission('agendar', { date: '2026-10-18', time: '10:00' }, null, '2026-10-19')
      .date,
  );
  assert.deepEqual(
    data.validateSubmission('agendar', { date: '2026-10-20', time: '10:00' }, null, '2026-10-19'),
    {},
  );
  assert.deepEqual(
    data
      .filterElevators(
        [
          {
            id: 'PRC-1',
            owner: 'Condomínio da Ria',
            address: 'Rua da Saúde',
            status: 'Válida',
            parish: 'Esgueira',
            company: 'Elevar',
            entryDate: '2026-01-01',
          },
        ],
        'saude',
        'Válida',
      )
      .map((e) => e.id),
    ['PRC-1'],
  );
  assert.equal(
    data.filterElevators(
      [
        {
          id: 'PRC-1',
          owner: 'Ria',
          address: 'Rua A',
          status: 'Válida',
          parish: 'Esgueira',
          company: 'Elevar',
          entryDate: '2026-01-01',
        },
      ],
      '',
      'Reprovada',
    ).length,
    0,
  );
  console.log('Validação de formulários, ficheiros, datas e pesquisa: OK');
  assert.equal(
    typeof data.decideRegistration,
    'function',
    'A decisão deve manter a associação e os totais dos avisos coerentes',
  );
  const registration = {
    id: 'r1',
    address: 'Rua A',
    postal: '3800-000',
    parish: 'Esgueira',
    owner: 'Ria',
    nif: '123456789',
    email: 'a@b.pt',
    company: 'Elevar',
    service: '2026-10-01',
    status: 'Por validar',
    permit: 'P1',
    dge: 'DGE-888',
    block: 'Bloco B',
    phone: '234000000',
    ownerType: 'Condomínio',
  };
  const initial = {
    registrations: [registration],
    elevators: [],
    urbanNotices: [
      {
        id: 'n1',
        address: 'Rua A',
        permit: 'P1',
        date: '2026-10-01',
        count: '1',
        owner: 'Ria',
        status: 'Por validar',
      },
      {
        id: 'n2',
        address: 'Rua B',
        permit: 'P2',
        date: '2026-10-01',
        count: '2',
        owner: 'Ria',
        status: 'Não registado',
      },
    ],
  };
  const approved = data.decideRegistration(initial, 'r1', true, '', 'P2');
  assert.equal(approved.registrations[0].permit, 'P2');
  assert.equal(approved.elevators[0].dge, 'DGE-888');
  assert.equal(approved.elevators[0].address, 'Rua A — Bloco B');
  assert.equal(approved.urbanNotices[0].status, 'Não registado');
  assert.equal(approved.urbanNotices[1].status, 'Parcialmente registado');
  const rejected = data.decideRegistration(initial, 'r1', false, 'NIF incorreto', 'P1');
  assert.equal(rejected.elevators.length, 0);
  assert.equal(rejected.registrations[0].reason, 'NIF incorreto');
  assert.equal(rejected.urbanNotices[0].status, 'Não registado');
  const alerted = data.reconcileNotices(
    [{ ...initial.urbanNotices[0], alerted: '2026-10-05' }],
    initial.registrations.map((r) => ({ ...r, status: 'Rejeitado' })),
  )[0];
  assert.equal(alerted.status, 'Não registado', 'O alerta não é um estado do aviso');
  assert.equal(alerted.alerted, '2026-10-05', 'A data do alerta mantém-se');
  assert.ok(
    data.validateSubmission(
      'reclamacao',
      { elevator: 'PRC-1', received: '2026-10-01', description: 'Porta avariada', status: '' },
      null,
    ).status,
  );
  assert.ok(
    data.validateSubmission(
      'registar',
      {
        address: 'Rua A',
        owner: 'Ria',
        parish: 'Esgueira',
        postal: '3800-000',
        nif: '123456789',
        email: 'a@b.pt',
        service: '2026-10-01',
        ownerType: '',
      },
      null,
    ).ownerType,
  );
  console.log('Decisões de registo e associação de avisos: OK');
  const lift = data.elevators.find((e) => e.id === '01.05.0112');
  const sent = data.sendManualNotice(data.elevatorNotices, lift, '2026-10-19');
  assert.equal(sent.length, data.elevatorNotices.length + 1);
  assert.deepEqual(
    { ...sent[0], id: undefined },
    {
      id: undefined,
      elevator: '01.05.0112',
      date: '2026-10-19',
      type: 'Manual',
      subject: 'Necessidade de inspeção',
      recipients: `${lift.owner} e ${lift.company}`,
    },
  );
  assert.notEqual(
    data.sendManualNotice(sent, lift, '2026-10-20')[0].id,
    sent[0].id,
    'Cada aviso manual deve ter uma referência própria',
  );
  assert.equal(
    sent.some((n) => n.elevator === '01.05.0079' && n.type === 'Manual'),
    false,
    'O aviso manual só pertence ao elevador escolhido',
  );
  assert.equal(
    data.elevatorHistory('01.05.0079', [
      {
        id: '2026/teste',
        elevator: '01.05.0079',
        date: '2026-10-01',
        scope: 'Inspeção',
        status: 'Concluído',
        scheduled: '2026-10-18T10:00',
        performed: '2026-10-19',
        result: 'Aprovada',
      },
    ])[0].entry,
    '2026/teste',
  );
  assert.ok(
    data.validateSubmission(
      'resultado',
      { result: 'Aprovada', performed: '2026-10-19', validUntil: '2026-10-18' },
      { name: 'r.pdf', size: 123, type: 'application/pdf' },
    ).validUntil,
  );
  console.log('Histórico partilhado e validade dos certificados: OK');
  assert.equal(data.formatDate('2026-10-05'), '05/10/2026');
  assert.equal(data.formatDate('2026-01-09T10:00'), '09/01/2026');
  assert.equal(data.formatDate(''), '—');
  assert.equal(data.parseDateInput('05/10/2026'), '2026-10-05');
  assert.equal(data.parseDateInput('10/05/2026'), '2026-05-10');
  assert.equal(data.parseDateInput('29/02/2024'), '2024-02-29');
  for (const invalid of ['29/02/2025', '31/04/2026', '10/19/2026', '2026-10-19', '1/2/2026', ''])
    assert.equal(data.parseDateInput(invalid), '');
  assert.ok(
    data.validateSubmission('agendar', { date: '31/04/2026', time: '10:00' }, null, '2026-10-19')
      .date,
  );
  assert.ok(
    data.validateSubmission('agendar', { date: '2026-02-30', time: '10:00' }, null, '2026-01-01')
      .date,
  );
  console.log('Datas DD/MM/YYYY e rejeição de datas impossíveis: OK');

  assert.equal(
    typeof data.certificateStatus,
    'function',
    'O estado atual deve considerar a validade do certificado',
  );
  assert.equal(data.certificateStatus('Aprovada', '2011-01-01', '2026-10-23'), 'Em atraso');
  assert.equal(data.certificateStatus('Aprovada', '2027-10-23', '2026-10-23'), 'Válida');
  assert.equal(data.certificateStatus('Aprovada', '2026-11-10', '2026-10-23'), 'A vencer');
  assert.equal(data.certificateStatus('Reprovada', '', '2026-10-23'), 'Reprovada');
  assert.equal(typeof data.resubmitRegistration, 'function');
  const refused = {
    ...registration,
    company: 'Elevar, Lda.',
    status: 'Rejeitado',
    reason: 'Corrigir NIF',
  };
  const resubmitted = data.resubmitRegistration(
    [refused],
    refused.id,
    { ...refused, nif: '987654321' },
    'manutencao',
  );
  assert.equal(resubmitted.length, 1);
  assert.equal(resubmitted[0].id, refused.id);
  assert.equal(resubmitted[0].status, 'Por validar');
  assert.equal(resubmitted[0].nif, '987654321');
  assert.equal(resubmitted[0].reason, 'Corrigir NIF');
  assert.equal(
    data.resubmitRegistration([refused], refused.id, { ...refused, nif: '987654321' }, 'gestor')[0]
      .status,
    'Rejeitado',
  );
  assert.equal(typeof data.resolveComplaint, 'function');
  const older = {
    id: 'REC-old',
    elevator: '01.05.0079',
    received: '2026-01-01',
    description: 'Porta avariada',
    status: 'Aberta',
  };
  const many = [...Array.from({ length: 5 }, (_, i) => ({ ...older, id: `REC-new-${i}` })), older];
  assert.equal(
    data.resolveComplaint(many, data.elevators, older.id, 'manutencao', '2026-10-23').at(-1).status,
    'Resolvida',
  );
  assert.equal(
    data.resolveComplaint(many, data.elevators, older.id, 'gestor', '2026-10-23').at(-1).status,
    'Aberta',
  );
  assert.equal(
    data.resolveComplaint(many, data.elevators, older.id, 'proprietario', '2026-10-23').at(-1).status,
    'Aberta',
  );
  const otherCompany = { ...older, elevator: '01.05.0247' };
  assert.equal(
    data.resolveComplaint([otherCompany], data.elevators, older.id, 'manutencao', '2026-10-23')[0]
      .status,
    'Aberta',
  );
  assert.equal(typeof data.updateSchedule, 'function');
  const rescheduled = data.updateSchedule(
    data.requests,
    '2026/0341',
    { date: '2026-11-02', time: '14:30' },
    'inspecao',
  );
  assert.equal(rescheduled.find((r) => r.id === '2026/0341').scheduled, '2026-11-02T14:30');
  assert.equal(
    data
      .updateSchedule(data.requests, '2025/0118', { date: '2026-11-02', time: '14:30' }, 'inspecao')
      .find((r) => r.id === '2025/0118').scheduled,
    '2025-03-03T10:00',
  );
  assert.equal(
    data
      .updateSchedule(data.requests, '2026/0341', { date: '2026-11-02', time: '14:30' }, 'gestor')
      .find((r) => r.id === '2026/0341').scheduled,
    '2026-11-19T10:00',
  );
  console.log(
    'Regressões da auditoria: validade, reapresentação, permissões EMA e reagendamento: OK',
  );
});
