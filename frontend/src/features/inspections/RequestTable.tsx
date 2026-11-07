import { detailPage } from '@/features/elevators/links';
import type { Request } from '@/features/inspections/types';
import { formatDate } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { Empty } from '@/shared/ui/Empty';
import { Icon } from '@/shared/ui/Icon';
import { usePrototype } from '@/app/state';

export function RequestTable({
  items,
  assigned = false,
  open = false,
}: {
  items: Request[];
  assigned?: boolean;
  open?: boolean;
}) {
  const s = usePrototype();

  return (
    <DataTable
      headers={[
        'Processo / data',
        'Ref. interna / DGE',
        'Morada / EMA',
        'Âmbito',
        'Estado',
        ...(open ? [] : ['Data da inspeção', ...(assigned ? ['Ação'] : [])]),
      ]}
    >
      {items.map((r) => {
        const e = s.elevators.find((e) => e.id === r.elevator);

        return (
          <tr key={r.id}>
            <td>
              <strong>{r.id}</strong>
              <small>{formatDate(r.date)}</small>
            </td>
            <td>
              <button
                className="text-button"
                onClick={() => s.go(detailPage(s.route.role), r.elevator)}
              >
                {r.elevator}
              </button>
              <small>{e?.dge}</small>
            </td>
            <td>
              {e?.address}
              <small>{e?.company}</small>
            </td>
            <td>{r.scope}</td>
            <td>
              <Badge>{r.status}</Badge>
            </td>
            {!open && (
              <>
                <td>
                  {formatDate(r.scheduled)}
                  {r.scheduled && <small>{r.scheduled.slice(11)}</small>}
                </td>
                {assigned && (
                  <td>
                    {r.status === 'Por agendar' ? (
                      <Button className="primary small" onClick={() => s.go('agendar', r.id)}>
                        Agendar
                      </Button>
                    ) : r.status === 'Agendado' ? (
                      <div className="row-actions">
                        <Button className="primary small" onClick={() => s.go('resultado', r.id)}>
                          Submeter resultado
                        </Button>
                        <button className="text-button" onClick={() => s.go('agendar', r.id)}>
                          Reagendar
                        </button>
                      </div>
                    ) : (
                      r.status === 'Concluído' && (
                        <button className="text-button" onClick={() => s.report(r.id, r.result)}>
                          <Icon name="download" />
                          Descarregar relatório
                        </button>
                      )
                    )}
                  </td>
                )}
              </>
            )}
          </tr>
        );
      })}
      {!items.length && (
        <tr>
          <td colSpan={open ? 5 : assigned ? 7 : 6}>
            <Empty>Não há pedidos com os filtros selecionados.</Empty>
          </td>
        </tr>
      )}
    </DataTable>
  );
}
