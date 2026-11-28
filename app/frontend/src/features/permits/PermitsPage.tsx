import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ApiPermit, PermitStatus } from '@/features/permits/api';
import { elevatorCounts, permitStatusLabel } from '@/features/permits/rules';
import { formatDate, localToday } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { Empty } from '@/shared/ui/Empty';
import { Heading } from '@/shared/ui/Heading';
import { Pagination, usePagination } from '@/shared/ui/Pagination';
import { Panel } from '@/shared/ui/Panel';
import { Tabs } from '@/shared/ui/Tabs';
import { usePrototype } from '@/app/state';

const tabStatus: Record<string, PermitStatus> = {
  'Por registar': 'missing',
  'Por validar': 'pending',
  Registado: 'registered',
};

/** O gestor só acompanha o que falta registar: os alvarás registados saem da lista dele. */
export function visiblePermits(permits: ApiPermit[], tab: string, urban: boolean) {
  return permits.filter(
    (p) => (urban || p.status !== 'registered') && (tab === 'Todos' || p.status === tabStatus[tab]),
  );
}

/** Erro ou carregamento da lista de alvarás; com a lista carregada, mostra `children`. */
export function PermitsTableState({
  permits,
  error,
  onRetry,
  children,
}: {
  permits: ApiPermit[] | null;
  error: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (error)
    return (
      <Banner tone="warning" action={<Button onClick={onRetry}>Tentar novamente</Button>}>
        Não foi possível carregar os alvarás.
      </Banner>
    );
  if (!permits) return <p role="status">A carregar alvarás…</p>;

  return <>{children}</>;
}

export function PermitsPage() {
  const s = usePrototype();
  const urban = s.route.role === 'urbanismo';
  const [tab, setTab] = useState('Todos');
  const items = visiblePermits(s.permits ?? [], tab, urban);
  const pages = usePagination(items, { reset: tab });

  return (
    <>
      <Heading
        title={urban ? 'Alvarás registados' : 'Elevadores não registados'}
        description={
          urban
            ? 'Alvarás de utilização comunicados à divisão de elevadores.'
            : 'Alvarás comunicados pelo Urbanismo cujo registo ainda necessita de acompanhamento.'
        }
      />
      <Panel>
        <div className="filters">
          <Tabs
            items={
              urban
                ? ['Todos', 'Por registar', 'Por validar', 'Registado']
                : ['Todos', 'Por registar', 'Por validar']
            }
            value={tab}
            onChange={setTab}
          />
          {urban && (
            <Button className="add-button" onClick={() => s.go('novo-aviso')}>
              <span aria-hidden="true">+</span> Registar novo alvará
            </Button>
          )}
        </div>
        <PermitsTableState permits={s.permits} error={s.permitsError} onRetry={s.reloadPermits}>
          <DataTable
            headers={[
              'Edifício / alvará',
              'Data do alvará',
              'Elevadores',
              'Proprietário',
              'Estado',
              ...(urban ? [] : ['Alerta', 'Ação']),
            ]}
          >
            {pages.items.map((p) => {
              const alerted = s.alerted[p.id] ?? p.last_alert_at?.slice(0, 10);

              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.address}</strong>
                    <small>Alvará {p.permit_number}</small>
                  </td>
                  <td>{formatDate(p.permit_date)}</td>
                  <td>
                    <strong>{p.num_elevators}</strong>
                    <small>{elevatorCounts(p)}</small>
                  </td>
                  <td>{p.owner_name}</td>
                  <td>
                    <Badge>{permitStatusLabel(p.status)}</Badge>
                  </td>
                  {!urban && (
                    <td>{alerted ? `Emitido em ${formatDate(alerted)}` : 'Não emitido'}</td>
                  )}
                  {!urban && (
                    <td className="action-cell">
                      {p.status === 'pending' ? (
                        <Button
                          onClick={() =>
                            s.go(
                              'validacoes',
                              String(
                                s.pendingRegistrations?.find((r) => r.permit?.id === p.id)?.id ??
                                  '',
                              ),
                            )
                          }
                        >
                          Analisar
                        </Button>
                      ) : (
                        <Button
                          onClick={() =>
                            s.confirm(
                              'Emitir alerta ao proprietário',
                              `Registar um alerta relativo a ${p.address}? Neste protótipo não será enviado correio eletrónico.`,
                              () => {
                                s.setAlerted((items) => ({ ...items, [p.id]: localToday() }));
                                s.notify('Alerta registado na demonstração.');
                              },
                              'Emitir alerta',
                            )
                          }
                        >
                          {alerted ? 'Reemitir alerta' : 'Emitir alerta ao proprietário'}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </DataTable>
          {!items.length && <Empty />}
          <Pagination pagination={pages} footer />
        </PermitsTableState>
      </Panel>
      {!urban && (
        <Banner>
          O alerta informa o proprietário de que o elevador não está registado e de que a sua
          empresa de manutenção deve efetuar o registo no Elevate.
        </Banner>
      )}
    </>
  );
}
