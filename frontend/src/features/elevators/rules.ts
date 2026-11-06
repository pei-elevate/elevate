import type { Elevator, ElevatorFilters, Registration } from '@/features/elevators/types';
import { inspectionHistory } from '@/features/inspections/mocks';
import type { Request } from '@/features/inspections/types';
import { reconcileNotices } from '@/features/permits/rules';
import type { UrbanNotice } from '@/features/permits/types';
import type { Role } from '@/shared/auth/roles';
import { isISODate, localToday } from '@/shared/lib/dates';
import { normalize } from '@/shared/lib/text';

export const defaultElevatorFilters: ElevatorFilters = {
  query: '',
  status: 'Todos',
  parish: 'Todas',
  company: 'Todas',
  year: 'Todos',
};

export function filterElevators<
  T extends { id: string; owner: string; address: string; status: string },
>(items: T[], query: string, status = 'Todos') {
  return items.filter(
    (e) =>
      (status === 'Todos' || e.status === status) &&
      normalize(Object.values(e).join(' ')).includes(normalize(query.trim())),
  );
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
