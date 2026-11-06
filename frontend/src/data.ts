export type Role = 'proprietario' | 'manutencao' | 'urbanismo' | 'gestor' | 'inspecao';

export const roles: Record<Role, string> = {
  proprietario: 'Proprietário',
  manutencao: 'Empresa de manutenção',
  urbanismo: 'Urbanismo',
  gestor: 'Gestor municipal',
  inspecao: 'Empresa de inspeção',
};

export const navigation: Record<Role, [string, string, string][]> = {
  proprietario: [
    ['painel', 'Painel geral', 'dashboard'],
    ['elevadores', 'Os meus elevadores', 'elevators'],
  ],
  manutencao: [
    ['elevadores', 'Painel geral', 'dashboard'],
    ['registar', 'Registar elevador', 'register'],
    ['inspecoes', 'Inspeções', 'calendar'],
    ['reprovadas', 'Inspeções reprovadas', 'failed'],
    ['reclamacoes', 'Reclamações', 'complaints'],
  ],
  urbanismo: [
    ['avisos', 'Alvarás registados', 'notices'],
    ['novo-aviso', 'Registar novo alvará', 'register'],
  ],
  gestor: [
    ['painel', 'Painel geral', 'dashboard'],
    ['cadastro', 'Elevadores registados', 'elevators'],
    ['validacoes', 'Validar registo', 'check'],
    ['nao-registados', 'Elevadores não registados', 'notices'],
    ['pedidos', 'Pedidos de inspeção', 'calendar'],
    ['reprovadas', 'Inspeções reprovadas', 'failed'],
  ],
  inspecao: [
    ['atribuidas', 'Inspeções atribuídas', 'check'],
    ['agendar', 'Agendar inspeções', 'calendar'],
  ],
};

export interface Elevator {
  id: string;
  dge: string;
  owner: string;
  address: string;
  parish: string;
  company: string;
  inspector: string;
  validUntil: string;
  status: string;
  entry: string;
  entryDate: string;
  scope: string;
}

const elevatorRows = [
  [
    '01.05.0079',
    'Condomínio Edifício Ria',
    'Rua de Viseu 12',
    '2026-12-12',
    'A vencer',
    '2024/0611',
    '2024-10-02',
  ],
  [
    '01.05.0112',
    'Condomínio Edifício Ria',
    'Rua de Viseu 14',
    '2027-03-03',
    'Válida',
    '2025/0118',
    '2025-01-14',
  ],
  [
    '01.05.0154',
    'Condomínio Edifício Ria',
    'Av. Dr. Lourenço Peixinho 85',
    '2026-06-20',
    'Em atraso',
    '2026/0341',
    '2026-10-02',
  ],
  [
    '01.05.0203',
    'Condomínio Mendonça 5',
    'Rua João Mendonça 5',
    '2026-11-17',
    'A vencer',
    '2026/0377',
    '2026-10-08',
  ],
  [
    '01.05.0231',
    'Condomínio Von Haff 40',
    'Rua Eng. Von Haff 40',
    '',
    'Reprovada',
    '2026/0362',
    '2026-10-09',
  ],
  [
    '01.05.0247',
    'Condomínio Beringela',
    'Rua Direita 64',
    '2028-02-08',
    'Válida',
    '2024/0207',
    '2024-03-11',
  ],
  [
    '01.05.0263',
    'Condomínio das Neves',
    'Rua Dr. Manuel das Neves 21',
    '2026-11-29',
    'A vencer',
    '2026/0312',
    '2026-09-10',
  ],
  [
    '01.05.0285',
    'Condomínio da Pega',
    'Rua da Pega 14',
    '2026-08-11',
    'Em atraso',
    '2026/0255',
    '2026-07-05',
  ],
];

export const elevators: Elevator[] = elevatorRows.map(
  ([id, owner, address, validUntil, status, entry, entryDate], i) => ({
    id,
    owner,
    address,
    validUntil,
    status,
    entry,
    entryDate,
    dge: `DGE-10${id.slice(-3)}`,
    parish: i > 4 ? 'Esgueira' : 'Glória e Vera Cruz',
    company: i === 5 ? 'Ascende, Lda.' : 'Elevar, Lda.',
    inspector: 'Inspeave, Lda.',
    scope: i === 4 ? 'Reinspeção' : 'Inspeção',
  }),
);

export interface Request {
  id: string;
  elevator: string;
  date: string;
  scope: string;
  status: string;
  scheduled: string;
  result: string;
  performed?: string;
  report?: string;
  nonconformities?: string;
}

export const requests: Request[] = [
  {
    id: '2026/0377',
    elevator: '01.05.0203',
    date: '2026-10-08',
    scope: 'Inspeção',
    status: 'Por agendar',
    scheduled: '',
    result: '',
  },
  {
    id: '2026/0369',
    elevator: '01.05.0247',
    date: '2026-10-07',
    scope: 'Inspeção',
    status: 'Por agendar',
    scheduled: '',
    result: '',
  },
  {
    id: '2026/0362',
    elevator: '01.05.0231',
    date: '2026-10-09',
    scope: 'Reinspeção',
    status: 'Por agendar',
    scheduled: '',
    result: '',
  },
  {
    id: '2026/0341',
    elevator: '01.05.0154',
    date: '2026-10-02',
    scope: 'Inspeção',
    status: 'Agendado',
    scheduled: '2026-11-19T10:00',
    result: '',
  },
  {
    id: '2025/0118',
    elevator: '01.05.0112',
    date: '2025-01-14',
    scope: 'Inspeção',
    status: 'Concluído',
    scheduled: '2025-03-03T10:00',
    result: 'Aprovada',
  },
];

export interface Complaint {
  id: string;
  elevator: string;
  received: string;
  description: string;
  status: string;
  responded?: string;
}

export const complaints: Complaint[] = [
  {
    id: 'REC-001',
    elevator: '01.05.0154',
    received: '2026-10-08',
    description: 'Elevador a parar entre os pisos 2 e 3.',
    status: 'Aberta',
  },
  {
    id: 'REC-002',
    elevator: '01.05.0079',
    received: '2026-09-22',
    description: 'Iluminação da cabina avariada.',
    status: 'Resolvida',
    responded: '2026-09-23',
  },
  {
    id: 'REC-003',
    elevator: '01.05.0203',
    received: '2026-09-04',
    description: 'Porta a fechar demasiado depressa.',
    status: 'Resolvida',
    responded: '2026-09-06',
  },
];

export interface Registration {
  id: string;
  address: string;
  postal: string;
  parish: string;
  owner: string;
  nif: string;
  email: string;
  company: string;
  service: string;
  status: string;
  permit: string;
  document?: string;
  reason?: string;
  dge?: string;
  block?: string;
  phone?: string;
  ownerType?: string;
}

export const registrations: Registration[] = [
  {
    id: 'REG-001',
    address: 'Rua do Gravito 18',
    postal: '3800-000',
    parish: 'Glória e Vera Cruz',
    owner: 'Condomínio Gravito 18',
    nif: '901234567',
    email: 'administracao@gravito18.pt',
    company: 'Elevar, Lda.',
    service: '2026-10-01',
    status: 'Por validar',
    permit: '118/2026',
    document: 'contrato-manutencao.pdf',
  },
  {
    id: 'REG-002',
    address: 'Rua Cónego Maio 22',
    postal: '3800-000',
    parish: 'Esgueira',
    owner: 'Condomínio Cónego Maio',
    nif: '901234568',
    email: 'administracao@maio22.pt',
    company: 'Ascende, Lda.',
    service: '2026-09-20',
    status: 'Por validar',
    permit: '104/2026',
    document: 'contrato-manutencao.pdf',
  },
];

export interface UrbanNotice {
  id: string;
  address: string;
  permit: string;
  date: string;
  count: string;
  owner: string;
  status: string;
  /** Data do último alerta emitido ao proprietário, se existir. */
  alerted?: string;
}

export const urbanNotices: UrbanNotice[] = [
  {
    id: 'AV-001',
    address: 'Rua Cónego Maio 22',
    permit: '104/2026',
    date: '2026-09-24',
    count: '2',
    owner: 'Condomínio Cónego Maio',
    status: 'Não registado',
  },
  {
    id: 'AV-002',
    address: 'Rua do Gravito 18',
    permit: '118/2026',
    date: '2026-10-07',
    count: '1',
    owner: 'Condomínio Gravito 18',
    status: 'Por validar',
  },
  {
    id: 'AV-003',
    address: 'Rua de Viseu 30',
    permit: '097/2026',
    date: '2026-09-11',
    count: '1',
    owner: 'Condomínio Viseu 30',
    status: 'Não registado',
    alerted: '2026-09-28',
  },
];

export const failedInspections = [
  {
    elevator: '01.05.0231',
    date: '2026-09-18',
    deadline: '2026-10-18',
    resolved: true,
    requestId: '',
  },
  {
    elevator: '01.05.0154',
    date: '2026-10-02',
    deadline: '2026-11-01',
    resolved: true,
    requestId: '',
  },
  {
    elevator: '01.05.0263',
    date: '2026-10-15',
    deadline: '2026-11-14',
    resolved: false,
    requestId: '',
  },
  {
    elevator: '01.05.0285',
    date: '2026-08-20',
    deadline: '2026-09-19',
    resolved: false,
    requestId: '',
  },
];

export const inspectionHistory = [
  {
    entry: '2024/0611',
    date: '2024-10-02',
    scope: 'Inspeção',
    performed: '2024-12-14',
    result: 'Aprovada',
  },
  {
    entry: '2022/0544',
    date: '2022-10-10',
    scope: 'Reinspeção',
    performed: '2022-11-02',
    result: 'Aprovada',
  },
  {
    entry: '2022/0398',
    date: '2022-07-12',
    scope: 'Inspeção',
    performed: '2022-10-05',
    result: 'Reprovada',
  },
  {
    entry: '2020/0287',
    date: '2020-06-03',
    scope: 'Inspeção',
    performed: '2020-09-15',
    result: 'Aprovada',
  },
  {
    entry: '2015/0904',
    date: '2015-11-20',
    scope: 'Inspeção',
    performed: '2016-01-10',
    result: 'Aprovada',
  },
];

export interface ElevatorNotice {
  id: string;
  elevator: string;
  date: string;
  type: 'Automático' | 'Manual';
  subject: string;
  recipients: string;
}

export const elevatorNotices: ElevatorNotice[] = [
  {
    id: 'AV-001',
    elevator: '01.05.0079',
    date: '2026-10-12',
    type: 'Automático',
    subject: 'Certificado a vencer',
    recipients: 'Condomínio Edifício Ria e Elevar, Lda.',
  },
];

export function sendManualNotice(
  notices: ElevatorNotice[],
  elevator: Elevator,
  today = localToday(),
): ElevatorNotice[] {
  return [
    {
      id: `AV-${String(notices.length + 1).padStart(3, '0')}`,
      elevator: elevator.id,
      date: today,
      type: 'Manual',
      subject: 'Necessidade de inspeção',
      recipients: `${elevator.owner} e ${elevator.company}`,
    },
    ...notices,
  ];
}

export function formatDate(v: string) {
  return v
    ? new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(v.slice(0, 10) + 'T12:00:00'))
    : '—';
}

export function isISODate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function parseDateInput(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);

  if (!match) return '';

  const iso = `${match[3]}-${match[2]}-${match[1]}`;

  return isISODate(iso) ? iso : '';
}

export function localToday() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function normalize(v: string) {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT');
}

export function filterElevators<
  T extends { id: string; owner: string; address: string; status: string },
>(items: T[], query: string, status = 'Todos') {
  return items.filter(
    (e) =>
      (status === 'Todos' || e.status === status) &&
      normalize(Object.values(e).join(' ')).includes(normalize(query.trim())),
  );
}

export type Values = Record<string, string>;

export type Upload = { name: string; type: string; size: number };

export function validateSubmission(
  kind: string,
  v: Values,
  file: Upload | null,
  today = localToday(),
): Values {
  const errors: Values = {};
  const required = (key: string, label: string) => {
    if (!v[key]?.trim()) errors[key] = `Indique ${label}.`;
  };

  if (kind === 'registar' || kind === 'novo-aviso') {
    required('address', 'a morada');
    required('owner', 'o nome do proprietário');
    required('parish', 'a freguesia');

    if (!/^\d{4}-\d{3}$/.test(v.postal ?? '')) errors.postal = 'Use o formato 3800-000.';

    if (!/^\d{9}$/.test(v.nif ?? '')) errors.nif = 'O NIF deve ter 9 algarismos.';
  }

  if (kind === 'registar') {
    if (!['Condomínio', 'Pessoa singular', 'Pessoa coletiva'].includes(v.ownerType))
      errors.ownerType = 'Selecione o tipo de proprietário.';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email ?? ''))
      errors.email = 'Indique um endereço de correio eletrónico válido.';

    required('service', 'a data de entrada em serviço');

    if (v.service > today) errors.service = 'A entrada em serviço não pode ser futura.';
  }

  if (kind === 'novo-aviso') {
    required('permit', 'o número do alvará');
    required('permitDate', 'a data do alvará');

    if (v.permitDate > today) errors.permitDate = 'A data do alvará não pode ser futura.';

    if (!/^\d+$/.test(v.count ?? '') || Number(v.count) < 1)
      errors.count = 'Indique pelo menos um elevador.';
  }

  if (kind === 'reclamacao') {
    if (!['Aberta', 'Resolvida'].includes(v.status))
      errors.status = 'Selecione o estado da reclamação.';

    required('elevator', 'o elevador');
    required('received', 'a data de receção');
    required('description', 'a descrição do problema');

    if (v.received > today) errors.received = 'A data de receção não pode ser futura.';
  }

  if (kind === 'agendar') {
    required('date', 'a data da inspeção');
    required('time', 'a hora');

    if (v.date && v.date < today) errors.date = 'Escolha a data de hoje ou uma data futura.';
  }

  if (kind === 'resultado') {
    if (!['Aprovada', 'Reprovada'].includes(v.result))
      errors.result = 'Selecione o resultado da inspeção.';

    required('performed', 'a data de realização');

    if (v.performed > today) errors.performed = 'A data de realização não pode ser futura.';

    if (v.result === 'Reprovada') {
      required('nonconformities', 'as não conformidades');
      required('deadline', 'o prazo de correção');

      if (v.deadline && v.deadline < v.performed)
        errors.deadline = 'O prazo deve ser posterior à data de realização.';
    }

    if (v.result === 'Aprovada') {
      required('validUntil', 'a validade do certificado');

      if (v.validUntil && v.validUntil <= v.performed)
        errors.validUntil = 'A validade deve ser posterior à data da inspeção.';
    }

    if (!file) errors.document = 'Anexe o relatório ou certificado em PDF.';
  }

  if (
    file &&
    (file.size > 10 * 1024 * 1024 ||
      file.size === 0 ||
      !file.name.toLowerCase().endsWith('.pdf') ||
      (file.type && file.type !== 'application/pdf'))
  )
    errors.document = 'Escolha um ficheiro PDF não vazio, até 10 MB.';

  const dateFields =
    kind === 'registar'
      ? ['service']
      : kind === 'novo-aviso'
        ? ['permitDate']
        : kind === 'reclamacao'
          ? ['received']
          : kind === 'agendar'
            ? ['date']
            : kind === 'resultado'
              ? ['performed', v.result === 'Aprovada' ? 'validUntil' : 'deadline']
              : [];

  for (const key of dateFields) {
    if (v[key] && !isISODate(v[key]))
      errors[key] = 'Indique uma data válida no formato DD/MM/YYYY.';
  }

  return errors;
}

export function reconcileNotices(notices: UrbanNotice[], regs: Registration[]) {
  return notices.map((n) => {
    const linked = regs.filter((r) => r.permit === n.permit);
    const approved = linked.filter((r) => r.status === 'Registado').length;
    const status =
      approved >= Number(n.count)
        ? 'Registado'
        : approved > 0
          ? 'Parcialmente registado'
          : linked.some((r) => r.status === 'Por validar')
            ? 'Por validar'
            : 'Não registado';

    return { ...n, status };
  });
}

export function decideRegistration(
  state: { registrations: Registration[]; elevators: Elevator[]; urbanNotices: UrbanNotice[] },
  id: string,
  approve: boolean,
  reason: string,
  permit: string,
) {
  const current = state.registrations.find((r) => r.id === id && r.status === 'Por validar');

  if (!current) return state;

  const registrations = state.registrations.map((r) =>
    r.id === id
      ? {
          ...r,
          permit,
          status: approve ? 'Registado' : 'Rejeitado',
          reason: approve ? undefined : reason.trim(),
        }
      : r,
  );
  let elevators = state.elevators;

  if (approve) {
    const ref = `01.05.${String(Math.max(0, ...elevators.map((e) => Number(e.id.slice(-4)))) + 1).padStart(4, '0')}`;
    elevators = [
      ...elevators,
      {
        id: ref,
        dge: current.dge || 'Por atribuir',
        owner: current.owner,
        address: current.address + (current.block ? ' — ' + current.block : ''),
        parish: current.parish,
        company: current.company,
        inspector: 'Por atribuir',
        validUntil: '',
        status: 'Por inspecionar',
        entry: '—',
        entryDate: localToday(),
        scope: 'Inspeção',
      },
    ];
  }

  return {
    registrations,
    elevators,
    urbanNotices: reconcileNotices(state.urbanNotices, registrations),
  };
}

export function elevatorHistory(id: string, items: Request[]) {
  const fresh = items
    .filter((r) => r.elevator === id && r.result)
    .map((r) => ({
      entry: r.id,
      date: r.date,
      scope: r.scope,
      performed: r.performed || r.scheduled,
      result: r.result,
    }));

  return [
    ...fresh,
    ...(id === '01.05.0079'
      ? inspectionHistory.filter((h) => !fresh.some((r) => r.entry === h.entry))
      : []),
  ].sort((a, b) => b.performed.localeCompare(a.performed));
}

export function certificateStatus(result: string, validUntil: string, today = localToday()) {
  if (result === 'Reprovada') return 'Reprovada';
  if (!isISODate(validUntil)) return 'Por inspecionar';
  if (validUntil < today) return 'Em atraso';

  const [year, month, day] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const cutoff = new Date(Date.UTC(year, month + 1, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);

  return validUntil <= cutoff ? 'A vencer' : 'Válida';
}

export function resubmitRegistration(
  registrations: Registration[],
  id: string,
  changes: Partial<Registration>,
  role: Role,
) {
  return registrations.map((registration) =>
    role === 'manutencao' &&
    registration.id === id &&
    registration.company === 'Elevar, Lda.' &&
    registration.status === 'Rejeitado'
      ? {
          ...registration,
          ...changes,
          id: registration.id,
          company: registration.company,
          reason: registration.reason,
          status: 'Por validar',
        }
      : registration,
  );
}

export function resolveComplaint(
  complaints: Complaint[],
  elevators: Elevator[],
  id: string,
  role: Role,
  today = localToday(),
) {
  return complaints.map((complaint) =>
    complaint.id === id && canResolveComplaint(complaint, elevators, role)
      ? { ...complaint, status: 'Resolvida', responded: today }
      : complaint,
  );
}

export function updateSchedule(requests: Request[], id: string, values: Values, role: Role) {
  return requests.map((request) =>
    role === 'inspecao' && request.id === id && ['Por agendar', 'Agendado'].includes(request.status)
      ? { ...request, status: 'Agendado', scheduled: `${values.date}T${values.time}` }
      : request,
  );
}

export interface ElevatorFilters {
  query: string;
  status: string;
  parish: string;
  company: string;
  year: string;
}

export const defaultElevatorFilters: ElevatorFilters = {
  query: '',
  status: 'Todos',
  parish: 'Todas',
  company: 'Todas',
  year: 'Todos',
};

export function canResolveComplaint(complaint: Complaint, elevators: Elevator[], role: Role) {
  return (
    role === 'manutencao' &&
    complaint.status === 'Aberta' &&
    elevators.some((e) => e.id === complaint.elevator && e.company === 'Elevar, Lda.')
  );
}
