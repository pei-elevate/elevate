import { useState } from 'react';
import type { UrbanNotice } from '@/features/permits/types';
import { formatDate, localToday } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { Empty } from '@/shared/ui/Empty';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';
import { Tabs } from '@/shared/ui/Tabs';
import { usePrototype } from '@/app/state';

export function PermitsPage() {
  const s = usePrototype();
  const urban = s.route.role === 'urbanismo';
  const [tab, setTab] = useState('Todos');
  // O gestor só acompanha o que falta registar: um aviso parcialmente registado ainda tem
  // elevadores por registar, e os avisos totalmente registados saem da lista.
  const status = (n: UrbanNotice) =>
    !urban && n.status === 'Parcialmente registado' ? 'Não registado' : n.status;
  const items = s.urbanNotices.filter(
    (n) => (urban || n.status !== 'Registado') && (tab === 'Todos' || status(n) === tab),
  );

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
          <Tabs items={['Todos', 'Não registado', 'Por validar']} value={tab} onChange={setTab} />
          {urban && (
            <Button className="add-button" onClick={() => s.go('novo-aviso')}>
              <span aria-hidden="true">+</span> Registar novo alvará
            </Button>
          )}
        </div>
        <DataTable
          headers={[
            'Edifício / alvará',
            'Comunicado em',
            'Elevadores',
            'Proprietário',
            'Estado',
            ...(urban ? [] : ['Alerta', 'Ação']),
          ]}
        >
          {items.map((n) => (
            <tr key={n.id}>
              <td>
                <strong>{n.address}</strong>
                <small>Alvará {n.permit}</small>
              </td>
              <td>{formatDate(n.date)}</td>
              <td>{n.count}</td>
              <td>{n.owner}</td>
              <td>
                <Badge>{status(n)}</Badge>
              </td>
              {!urban && (
                <td>{n.alerted ? `Emitido em ${formatDate(n.alerted)}` : 'Não emitido'}</td>
              )}
              {!urban && (
                <td className="action-cell">
                  {n.status === 'Por validar' ? (
                    <Button
                      onClick={() =>
                        s.go(
                          'validacoes',
                          s.registrations.find((r) => r.permit === n.permit)?.id || '',
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
                          `Registar um alerta relativo a ${n.address}? Neste protótipo não será enviado correio eletrónico.`,
                          () => {
                            s.setUrbanNotices((items) =>
                              items.map((item) =>
                                item.id === n.id ? { ...item, alerted: localToday() } : item,
                              ),
                            );
                            s.notify('Alerta registado na demonstração.');
                          },
                          'Emitir alerta',
                        )
                      }
                    >
                      {n.alerted ? 'Reemitir alerta' : 'Emitir alerta ao proprietário'}
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </DataTable>
        {!items.length && <Empty />}
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
