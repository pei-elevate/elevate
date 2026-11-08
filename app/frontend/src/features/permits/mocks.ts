import type { UrbanNotice } from '@/features/permits/types';

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
