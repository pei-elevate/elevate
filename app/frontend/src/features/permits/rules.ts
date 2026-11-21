import type { Registration } from '@/features/elevators/types';
import type { ApiPermit, PermitStatus } from '@/features/permits/api';
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

const statusLabels: Record<PermitStatus, string> = {
  missing: 'Por registar',
  pending: 'Por validar',
  registered: 'Registado',
};

export function permitStatusLabel(status: PermitStatus) {
  return statusLabels[status];
}

/** Ex.: «1 por registar · 0 por validar · 1 registado». */
export function elevatorCounts(p: Pick<ApiPermit, 'missing' | 'pending' | 'registered'>) {
  return `${p.missing} por registar · ${p.pending} por validar · ${p.registered} ${
    p.registered === 1 ? 'registado' : 'registados'
  }`;
}
