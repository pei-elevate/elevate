import type { Complaint } from '@/features/complaints/types';

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
