import type { Request } from '@/features/inspections/types';
import { api } from '@/shared/api/client';
import type { Role } from '@/shared/auth/roles';

/** Pedido atribuído à empresa de inspeção, como o backend o devolve (`AssignedRequestOut`). */
export interface ApiAssignedRequest {
  id: number;
  process_number: string;
  type: 'periodic' | 'extraordinary' | 'reinspection';
  status: 'awaiting_scheduling' | 'scheduled' | 'completed';
  submitted_at: string;
  scheduled_at: string | null;
  elevator: {
    internal_reference: string | null;
    address: string;
    maintenance_company: { name: string; phone: string | null; email: string | null };
  };
  inspection: {
    performed_date: string;
    result: 'approved' | 'failed';
  } | null;
}

const statuses: Record<ApiAssignedRequest['status'], string> = {
  awaiting_scheduling: 'Por agendar',
  scheduled: 'Agendado',
  completed: 'Concluído',
};

const scopes: Record<ApiAssignedRequest['type'], string> = {
  periodic: 'Inspeção',
  extraordinary: 'Inspeção extraordinária',
  reinspection: 'Reinspeção',
};

const results: Record<'approved' | 'failed', string> = {
  approved: 'Aprovada',
  failed: 'Reprovada',
};

export function listAssignedRequests(role: Role) {
  return api<ApiAssignedRequest[]>('/inspections/assigned', role);
}

/**
 * Pede os pedidos atribuídos e entrega-os já no formato da tabela, ou avisa do erro.
 * Devolve uma função que cancela: uma resposta que chegue depois já não é entregue.
 */
export function loadAssignedRequests(
  role: Role,
  onLoad: (items: Request[]) => void,
  onError: () => void,
) {
  let cancelled = false;
  listAssignedRequests(role)
    .then((items) => {
      if (!cancelled) onLoad(items.map(toRequest));
    })
    .catch(() => {
      if (!cancelled) onError();
    });

  return () => {
    cancelled = true;
  };
}

/** Converte para o formato que a tabela de pedidos já usa, com os textos em português. */
export function toRequest(r: ApiAssignedRequest): Request {
  return {
    id: r.process_number,
    elevator: r.elevator.internal_reference ?? '',
    date: r.submitted_at.slice(0, 10),
    scope: scopes[r.type],
    status: statuses[r.status],
    // Data e hora sem segundos, como nos dados de exemplo (2026-11-19T10:00).
    scheduled: r.scheduled_at?.slice(0, 16) ?? '',
    result: r.inspection ? results[r.inspection.result] : '',
    performed: r.inspection?.performed_date,
    address: r.elevator.address,
    company: r.elevator.maintenance_company.name,
  };
}
