import type { Elevator } from '@/features/elevators/types';
import { type ApiAssignedRequest, results, scopes } from '@/features/inspections/api';
import type { ElevatorNotice } from '@/features/notices/types';
import type { PermitSummary } from '@/features/permits/api';
import { ApiError, api } from '@/shared/api/client';
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
  dge_number: string | null;
  owner: {
    type: OwnerType | null;
    name: string;
    nif: string;
    email: string;
    phone: string | null;
  };
  maintenance_company: { name: string };
  permit: PermitSummary | null;
}

/** Registo que a empresa de manutenção submete, novo ou corrigido (`RegistrationIn`). */
export interface RegistrationBody {
  address: string;
  postal_code: string;
  parish: string;
  building: string | null;
  service_date: string;
  dge_number: string | null;
  owner_type: OwnerType;
  owner_name: string;
  owner_nif: string;
  owner_email: string;
  owner_phone: string | null;
  registration_document: string | null;
}

export function listPendingRegistrations(role: Role) {
  return api<ApiRegistration[]>('/registrations', role);
}

/** Registos da empresa de manutenção que ainda não deram elevador: por validar e rejeitados. */
export function listSubmittedRegistrations(role: Role) {
  return api<ApiRegistration[]>('/registrations?status=pending_approval&status=rejected', role);
}

export function submitRegistration(role: Role, body: RegistrationBody) {
  return api<ApiRegistration>('/registrations', role, { method: 'POST', body });
}

/** Volta a submeter um registo rejeitado, depois de corrigido. */
export function correctRegistration(role: Role, id: number, body: RegistrationBody) {
  return api<ApiRegistration>(`/registrations/${id}`, role, { method: 'PUT', body });
}

/** Erro ao submeter: o n.º DGE repetido vai para o seu campo, o resto para o formulário. */
export function registrationError(error: unknown): { field?: 'dge'; message: string } {
  if (error instanceof ApiError && error.status === 409 && /DGE/.test(error.message))
    return { field: 'dge', message: 'Já existe um elevador com este número DGE.' };
  if (error instanceof ApiError && error.status === 409)
    return { message: 'Este registo já não pode ser corrigido. A lista foi atualizada.' };

  return { message: 'Não foi possível submeter o registo. Tente novamente.' };
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

type CertificateStatus = 'valid' | 'due_soon' | 'overdue' | 'failed' | 'not_inspected';
type EquipmentType = 'elevator' | 'goods_lift' | 'escalator' | 'moving_walkway';
type OwnerType = 'condominium' | 'individual' | 'company';
type RequestType = ApiAssignedRequest['type'];
type InspectionResult = 'approved' | 'failed';

/** Elevador registado na lista de um perfil (`ElevatorSummaryOut`). */
export interface ApiElevatorSummary {
  id: number;
  internal_reference: string;
  dge_number: string | null;
  address: string;
  postal_code: string;
  parish: string;
  building: string | null;
  owner: { name: string };
  maintenance_company: { name: string };
  inspection_company: { name: string } | null;
  certificate_status: CertificateStatus;
  valid_until: string | null;
  latest_request: { process_number: string; submitted_at: string; type: RequestType } | null;
}

interface Contact {
  name: string;
  email: string | null;
  phone: string | null;
}

/** Ficha completa de um elevador (`ElevatorOut`). O alvará só vem para o gestor. */
export interface ApiElevator extends ApiElevatorSummary {
  equipment_type: EquipmentType;
  service_date: string;
  created_at: string | null;
  owner: {
    id: number;
    type: OwnerType | null;
    name: string;
    nif: string;
    email: string;
    phone: string | null;
  };
  maintenance_company: Contact;
  inspection_company: Contact | null;
  last_inspection: { performed_date: string; result: InspectionResult } | null;
  permit: PermitSummary | null;
}

/** Inspeção concluída de um elevador (`ElevatorInspectionOut`). */
export interface ApiElevatorInspection {
  process_number: string;
  submitted_at: string;
  type: RequestType;
  inspection_company: { name: string };
  performed_date: string;
  result: InspectionResult;
  valid_until: string | null;
  report_file: string;
}

/** Aviso enviado sobre um elevador (`ElevatorNoticeOut`). */
export interface ApiElevatorNotice {
  id: number;
  type: 'inspection_due' | 'inspection_required';
  subject: string;
  body: string;
  recipients: string;
  created_at: string | null;
}

export const certificateLabels: Record<CertificateStatus, string> = {
  valid: 'Válida',
  due_soon: 'A vencer',
  overdue: 'Em atraso',
  failed: 'Reprovada',
  not_inspected: 'Por inspecionar',
};

export const equipmentLabels: Record<EquipmentType, string> = {
  elevator: 'Elevador',
  goods_lift: 'Monta-cargas',
  escalator: 'Escada mecânica',
  moving_walkway: 'Tapete rolante',
};

export const ownerTypeLabels: Record<OwnerType, string> = {
  condominium: 'Condomínio',
  individual: 'Pessoa singular',
  company: 'Pessoa coletiva',
};

export const noticeTypeLabels: Record<ApiElevatorNotice['type'], ElevatorNotice['type']> = {
  inspection_due: 'Automático',
  inspection_required: 'Manual',
};

export function listElevators(role: Role) {
  return api<ApiElevatorSummary[]>('/elevators', role);
}

export function getElevator(role: Role, id: number) {
  return api<ApiElevator>(`/elevators/${id}`, role);
}

export function listElevatorInspections(role: Role, id: number) {
  return api<ApiElevatorInspection[]>(`/elevators/${id}/inspections`, role);
}

export function listElevatorNotices(role: Role, id: number) {
  return api<ApiElevatorNotice[]>(`/elevators/${id}/notices`, role);
}

/**
 * Faz o pedido e entrega a resposta, ou avisa do erro.
 * Devolve uma função que cancela: uma resposta que chegue depois já não é entregue.
 */
export function load<T>(
  fetcher: () => Promise<T>,
  onLoad: (data: T) => void,
  onError: (error: unknown) => void,
) {
  let cancelled = false;
  fetcher()
    .then((data) => {
      if (!cancelled) onLoad(data);
    })
    .catch((error: unknown) => {
      if (!cancelled) onError(error);
    });

  return () => {
    cancelled = true;
  };
}

/** Converte para o formato que a tabela de elevadores já usa, com os textos em português. */
export function toElevator(a: ApiElevatorSummary): Elevator {
  return {
    id: a.internal_reference,
    key: a.id,
    dge: a.dge_number ?? '—',
    owner: a.owner.name,
    address: a.address,
    parish: a.parish,
    company: a.maintenance_company.name,
    inspector: a.inspection_company?.name ?? 'Por atribuir',
    validUntil: a.valid_until ?? '',
    status: certificateLabels[a.certificate_status],
    entry: a.latest_request?.process_number ?? '—',
    entryDate: a.latest_request?.submitted_at.slice(0, 10) ?? '',
    scope: a.latest_request ? scopes[a.latest_request.type] : '—',
  };
}

/** Linha do histórico de inspeções, na forma das que `elevatorHistory` devolve. */
export function toInspectionRow(i: ApiElevatorInspection) {
  return {
    entry: i.process_number,
    date: i.submitted_at.slice(0, 10),
    scope: scopes[i.type],
    inspector: i.inspection_company.name,
    performed: i.performed_date,
    result: results[i.result],
  };
}

export function toNotice(n: ApiElevatorNotice, reference: string): ElevatorNotice {
  return {
    id: String(n.id),
    elevator: reference,
    date: n.created_at?.slice(0, 10) ?? '',
    type: noticeTypeLabels[n.type],
    subject: n.subject,
    recipients: n.recipients,
    body: n.body,
  };
}
