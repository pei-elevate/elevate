import type { Complaint } from '@/features/complaints/types';
import type { Elevator } from '@/features/elevators/types';
import type { Role } from '@/shared/auth/roles';
import { localToday } from '@/shared/lib/dates';

export function resolveComplaint(
  complaints: Complaint[],
  elevators: Elevator[],
  id: string,
  role: Role,
  today = localToday(),
) {
  return complaints.map((complaint) =>
    complaint.id === id && canResolveComplaint(complaint, elevators, role)
      ? { ...complaint, status: 'Resolvida', responded: today }
      : complaint,
  );
}

export function canResolveComplaint(complaint: Complaint, elevators: Elevator[], role: Role) {
  return (
    role === 'manutencao' &&
    complaint.status === 'Aberta' &&
    elevators.some((e) => e.id === complaint.elevator && e.company === 'Elevar, Lda.')
  );
}
