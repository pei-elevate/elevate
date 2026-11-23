import { ownerTypeLabels } from '@/features/elevators/api';
import type { ApiRegistration, RegistrationBody } from '@/features/elevators/api';
import type { Values } from '@/shared/forms/types';

type OwnerType = RegistrationBody['owner_type'];

/** Do texto do formulário («Condomínio») para o valor da API («condominium»). */
const ownerTypes = Object.fromEntries(
  Object.entries(ownerTypeLabels).map(([type, label]) => [label, type]),
) as Record<string, OwnerType>;

/** Os valores do formulário no formato da API, sem espaços à volta; opcionais vazios são null. */
export function toRegistrationBody(v: Values, document: string): RegistrationBody {
  const text = (key: string) => (v[key] ?? '').trim();

  return {
    address: text('address'),
    postal_code: text('postal'),
    parish: text('parish'),
    building: text('block') || null,
    service_date: text('service'),
    dge_number: text('dge') || null,
    owner_type: ownerTypes[v.ownerType],
    owner_name: text('owner'),
    owner_nif: text('nif'),
    owner_email: text('email'),
    owner_phone: text('phone') || null,
    registration_document: document || null,
  };
}

/** Um registo rejeitado nos campos do formulário, para o corrigir. */
export function toRegistrationValues(r: ApiRegistration): Values {
  return {
    address: r.address,
    postal: r.postal_code,
    parish: r.parish,
    block: r.building ?? '',
    service: r.service_date,
    dge: r.dge_number ?? '',
    ownerType: ownerTypeLabels[r.owner.type ?? 'condominium'],
    owner: r.owner.name,
    nif: r.owner.nif,
    email: r.owner.email,
    phone: r.owner.phone ?? '',
  };
}

export const registrationStatusLabels: Record<ApiRegistration['registration_status'], string> = {
  pending_approval: 'Por validar',
  approved: 'Registado',
  rejected: 'Rejeitado',
};
