import type { Elevator } from '@/features/elevators/types';
import type { ElevatorNotice } from '@/features/notices/types';
import { localToday } from '@/shared/lib/dates';

export function sendManualNotice(
  notices: ElevatorNotice[],
  elevator: Elevator,
  today = localToday(),
): ElevatorNotice[] {
  return [
    {
      id: `AV-${String(notices.length + 1).padStart(3, '0')}`,
      elevator: elevator.id,
      date: today,
      type: 'Manual',
      subject: 'Necessidade de inspeção',
      recipients: `${elevator.owner} e ${elevator.company}`,
    },
    ...notices,
  ];
}
