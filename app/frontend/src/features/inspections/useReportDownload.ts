import { usePrototype } from '@/app/state';
import { downloadReport } from '@/features/inspections/api';

/** O que identifica o relatório de uma linha: `key` (id do pedido na API) e, sem ela, os dados de exemplo. */
export interface ReportOf {
  id: string;
  key?: number;
  result?: string;
}

/**
 * «Descarregar relatório»: o PDF vem da API para os pedidos que vieram da API (com `key`);
 * os dados de exemplo continuam a abrir o relatório de demonstração.
 */
export function useReportDownload() {
  const s = usePrototype();

  return (r: ReportOf, bare = false) => {
    if (r.key === undefined) {
      s.report(r.id, r.result, undefined, bare);
      return;
    }
    downloadReport(s.route.role, r.key).catch(() =>
      s.notify('Não foi possível descarregar o relatório. Tente novamente.'),
    );
  };
}
