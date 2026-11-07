import type { Request } from '@/features/inspections/types';
import type { Role } from '@/shared/auth/roles';
import type { Values } from '@/shared/forms/types';

export function updateSchedule(requests: Request[], id: string, values: Values, role: Role) {
  return requests.map((request) =>
    role === 'inspecao' && request.id === id && ['Por agendar', 'Agendado'].includes(request.status)
      ? { ...request, status: 'Agendado', scheduled: `${values.date}T${values.time}` }
      : request,
  );
}
