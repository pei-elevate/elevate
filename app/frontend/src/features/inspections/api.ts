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
    dge_number: string | null;
    address: string;
    maintenance_company: { name: string; phone: string | null; email: string | null };
  };
  inspection: {
    performed_date: string;
    result: 'approved' | 'failed';
  } | null;
}

/**
 * Pedido acompanhado pela empresa de manutenção ou pelo gestor, como o backend o devolve
 * (`RequestStatusOut`): também traz a empresa de inspeção que o trata.
 */
export interface ApiTrackedRequest extends ApiAssignedRequest {
  elevator: ApiAssignedRequest['elevator'] & { id: number };
  inspection_company: { name: string; phone: string | null; email: string | null };
}

const statuses: Record<ApiAssignedRequest['status'], string> = {
  awaiting_scheduling: 'Por agendar',
  scheduled: 'Agendado',
  completed: 'Concluído',
};

export const scopes: Record<ApiAssignedRequest['type'], string> = {
  periodic: 'Inspeção',
  extraordinary: 'Inspeção extraordinária',
  reinspection: 'Reinspeção',
};

export const results: Record<'approved' | 'failed', string> = {
  approved: 'Aprovada',
  failed: 'Reprovada',
};

export function listAssignedRequests(role: Role) {
  return api<ApiAssignedRequest[]>('/inspections/assigned', role);
}

/** Pedidos da empresa de manutenção (os dos seus elevadores) ou do gestor (todos). */
export function listRequests(role: Role) {
  return api<ApiTrackedRequest[]>('/inspections/requests', role);
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
  return loadInto(listAssignedRequests(role), toRequest, onLoad, onError);
}

/** Como loadAssignedRequests, para os pedidos que a manutenção e o gestor acompanham. */
export function loadRequests(role: Role, onLoad: (items: Request[]) => void, onError: () => void) {
  return loadInto(listRequests(role), toTrackedRequest, onLoad, onError);
}

function loadInto<T>(
  pending: Promise<T[]>,
  convert: (item: T) => Request,
  onLoad: (items: Request[]) => void,
  onError: () => void,
) {
  let cancelled = false;
  pending
    .then((items) => {
      if (!cancelled) onLoad(items.map(convert));
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
    dge: r.elevator.dge_number ?? '—',
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

/** Como toRequest, com a empresa de inspeção que trata o pedido e o id do elevador. */
export function toTrackedRequest(r: ApiTrackedRequest): Request {
  return {
    ...toRequest(r),
    inspectionCompany: r.inspection_company.name,
    elevatorKey: r.elevator.id,
  };
}
