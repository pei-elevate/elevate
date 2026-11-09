import type { Request } from '@/features/inspections/types';

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
