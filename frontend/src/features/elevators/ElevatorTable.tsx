import { detailPage } from '@/features/elevators/links';
import type { Elevator } from '@/features/elevators/types';
import { formatDate } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge';
import { DataTable } from '@/shared/ui/DataTable';
import { Empty } from '@/shared/ui/Empty';
import { Icon } from '@/shared/ui/Icon';
import { usePrototype } from '@/app/state';

// No painel do proprietário, guardar a origem para os detalhes oferecerem o regresso ao painel.
function dashboardOrigin(role: string, page: string) {
  return role === 'proprietario' && page === 'painel'
    ? { page: 'painel', label: 'Painel geral' }
    : null;
}

export function ElevatorTable({
  items,
  registry = false,
  compact = false,
}: {
  items: Elevator[];
  registry?: boolean;
  compact?: boolean;
}) {
  const s = usePrototype();

  return (
    <DataTable
      stacked={registry}
      headers={
        registry
          ? [
              'Processo / data',
              'Ref. interna',
              'N.º DGE',
              'Entidade / morada',
              'EMA',
              'Âmbito',
              'Estado',
              '',
            ]
          : [
              'Ref. interna',
              'N.º DGE',
              'Entidade / morada',
              ...(compact ? ['EMA'] : ['Empresa de inspeção']),
              'Válido até',
              'Estado',
              '',
            ]
      }
    >
      {items.map((e) => (
        <tr key={e.id}>
          {registry && (
            <td>
              <strong>{e.entry}</strong>
              <small>{formatDate(e.entryDate)}</small>
            </td>
          )}
          <td>
            <strong>{e.id}</strong>
          </td>
          <td>{e.dge}</td>
          <td>
            {s.route.role === 'proprietario' ? (
              e.address
            ) : (
              <>
                <strong className="regular">{e.owner}</strong>
                <small>{e.address}</small>
              </>
            )}
          </td>
          <td>{compact || registry ? e.company : e.inspector}</td>
          {registry ? (
            <td>{e.scope}</td>
          ) : (
            <td>{formatDate(e.validUntil)}</td>
          )}
          <td>
            <Badge>{e.status}</Badge>
          </td>
          <td>
            <button
              className="text-button"
              aria-label={`Consultar ${e.id}`}
              onClick={() =>
                s.go(
                  detailPage(s.route.role),
                  e.id,
                  s.route.role,
                  dashboardOrigin(s.route.role, s.route.page),
                )
              }
            >
              {s.route.role === 'manutencao' ? 'Histórico' : 'Detalhes'}
              <Icon name="arrow" />
            </button>
          </td>
        </tr>
      ))}
      {!items.length && (
        <tr>
          <td colSpan={registry ? 8 : 7}>
            <Empty>Experimente outra pesquisa ou altere os filtros.</Empty>
          </td>
        </tr>
      )}
    </DataTable>
  );
}
