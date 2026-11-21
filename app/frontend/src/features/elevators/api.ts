import { ApiError, api } from '@/shared/api/client';
import type { PermitSummary } from '@/features/permits/api';
import type { Role } from '@/shared/auth/roles';

/** Registo de um elevador como o backend o devolve (`RegistrationOut`). */
export interface ApiRegistration {
  id: number;
  internal_reference: string | null;
  registration_status: 'pending_approval' | 'approved' | 'rejected';
  rejected_reason: string | null;
  address: string;
  postal_code: string;
  parish: string;
  building: string | null;
  service_date: string;
  registration_document: string | null;
  owner: { name: string; nif: string; email: string; phone: string | null };
  maintenance_company: { name: string };
  permit: PermitSummary | null;
}

export function listPendingRegistrations(role: Role) {
  return api<ApiRegistration[]>('/registrations', role);
}

export function approveRegistration(role: Role, id: number, permitId: number | null) {
  return api<ApiRegistration>(`/registrations/${id}/approve`, role, {
    method: 'POST',
    body: { permit_id: permitId },
  });
}

export function rejectRegistration(role: Role, id: number, reason: string) {
  return api<ApiRegistration>(`/registrations/${id}/reject`, role, {
    method: 'POST',
    body: { reason },
  });
}

/** Mensagem para o utilizador quando a decisão não foi guardada. */
export function decisionError(error: unknown) {
  if (error instanceof ApiError && error.status === 409)
    return 'Este registo já foi analisado entretanto. A lista foi atualizada.';
  if (error instanceof ApiError && error.status === 422)
    return 'O alvará escolhido já não existe. Escolha outro e tente novamente.';

  return 'Não foi possível guardar a decisão. Tente novamente.';
}
