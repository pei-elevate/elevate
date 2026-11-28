import { formatDate } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { Empty } from '@/shared/ui/Empty';
import { Icon } from '@/shared/ui/Icon';
import { Panel } from '@/shared/ui/Panel';
import { usePrototype } from '@/app/state';

/**
 * Pedidos de inspeção mais recentes no painel da empresa de manutenção e do gestor (ELEV-55):
 * o estado, a data marcada e o resultado quando existe. `page` é a lista completa.
 */
export function RecentRequests({ page }: { page: string }) {
  const s = usePrototype();
  const items = s.recentRequests ?? [];

  return (
    <Panel
      title="Pedidos de inspeção"
      tools={
        <button className="text-button" onClick={() => s.go(page)}>
          Ver todos os pedidos <Icon name="arrow" />
        </button>
      }
    >
      <DataTable
        headers={[
          'Processo / data',
          'Ref. interna',
          'Âmbito',
          'Estado',
          'Data da inspeção',
          'Resultado',
        ]}
      >
        {items.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.id}</strong>
              <small>{formatDate(r.date)}</small>
            </td>
            <td>
              {r.elevator}
              <small>{r.address}</small>
            </td>
            <td>{r.scope}</td>
            <td>
              <Badge>{r.status}</Badge>
            </td>
            <td>
              {formatDate(r.scheduled)}
              {r.scheduled && <small>{r.scheduled.slice(11)}</small>}
            </td>
            <td>{r.result ? <Badge>{r.result}</Badge> : '—'}</td>
          </tr>
        ))}
        {!s.recentRequests || s.recentError ? (
          <tr>
            <td colSpan={6}>
              <RecentRequestsState />
            </td>
          </tr>
        ) : (
          !items.length && (
            <tr>
              <td colSpan={6}>
                <Empty>Ainda não há pedidos de inspeção.</Empty>
              </td>
            </tr>
          )
        )}
      </DataTable>
    </Panel>
  );
}

/** A carregar, ou o erro com «Tentar novamente». */
export function RecentRequestsState() {
  const s = usePrototype();

  return s.recentError ? (
    <Banner
      tone="warning"
      action={<Button onClick={s.reloadRecentRequests}>Tentar novamente</Button>}
    >
      Não foi possível carregar os pedidos de inspeção.
    </Banner>
  ) : (
    <p role="status">A carregar pedidos…</p>
  );
}
