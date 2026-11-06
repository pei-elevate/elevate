import type { Registration } from '@/features/elevators/types';
import type { UrbanNotice } from '@/features/permits/types';

export function reconcileNotices(notices: UrbanNotice[], regs: Registration[]) {
  return notices.map((n) => {
    const linked = regs.filter((r) => r.permit === n.permit);
    const approved = linked.filter((r) => r.status === 'Registado').length;
    const status =
      approved >= Number(n.count)
        ? 'Registado'
        : approved > 0
          ? 'Parcialmente registado'
          : linked.some((r) => r.status === 'Por validar')
            ? 'Por validar'
            : 'Não registado';

    return { ...n, status };
  });
}
