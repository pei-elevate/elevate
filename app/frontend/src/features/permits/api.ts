import { ApiError, api } from '@/shared/api/client';
import type { Role } from '@/shared/auth/roles';

/** Os campos do alvará que o ecrã de validação de registos usa. */
export interface PermitSummary {
  id: number;
  permit_number: string;
  permit_date: string;
  address: string;
  num_elevators: number;
}

/** Por registar, por validar ou registado: calculado no backend a partir dos elevadores ligados. */
export type PermitStatus = 'missing' | 'pending' | 'registered';

/** Alvará como o backend o devolve (`PermitOut`). */
export interface ApiPermit extends PermitSummary {
  postal_code: string;
  parish: string;
  owner_name: string;
  registered: number;
  pending: number;
  missing: number;
  status: PermitStatus;
  last_alert_at: string | null;
}

/** Alvará como o Urbanismo o regista (`NewPermit`). */
export interface NewPermitBody {
  permit_number: string;
  permit_date: string;
  address: string;
  postal_code: string;
  parish: string;
  num_elevators: number;
  owner_name: string;
  owner_nif: string;
  owner_email: string;
  owner_phone: string | null;
}

export function listPermits(role: Role) {
  return api<ApiPermit[]>('/permits', role);
}

export function createPermit(role: Role, body: NewPermitBody) {
  return api<ApiPermit>('/permits', role, { method: 'POST', body });
}

/** Mensagem para o utilizador quando o alvará não foi guardado, e o campo a que se refere. */
export function permitError(error: unknown): { field?: 'permit'; message: string } {
  if (error instanceof ApiError && error.status === 409)
    return { field: 'permit', message: 'Já existe um alvará registado com este número.' };

  return { message: 'Não foi possível guardar o alvará. Tente novamente.' };
}
