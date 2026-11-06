import { useState } from 'react';
import { detailPage } from '@/features/elevators/links';
import { formatDate, localToday } from '@/shared/lib/dates';
import { normalize } from '@/shared/lib/text';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable } from '@/shared/ui/DataTable';
import { Empty } from '@/shared/ui/Empty';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { Panel } from '@/shared/ui/Panel';
import { Search } from '@/shared/ui/Search';
import { Tabs } from '@/shared/ui/Tabs';
import { usePrototype } from '@/state';

export function FailedInspectionsPage() {
  const s = usePrototype();
  const manager = s.route.role === 'gestor';
  const [status, setStatus] = useState('Todas');
  const [query, setQuery] = useState('');
  const rows = s.failed.filter(
    (f) =>
      (status === 'Todas' ||
        (status === 'Corrigidas' && f.resolved) ||
        (status === 'Não corrigidas' && !f.resolved)) &&
      normalize(`${f.elevator} ${s.elevators.find((e) => e.id === f.elevator)?.address}`).includes(
        normalize(query),
      ),
  );

  function corrected(id: string) {
    const e = s.elevators.find((e) => e.id === id)!;
    s.confirm(
      'Assinalar como corrigido',
      <>
        <p>
          Confirma que todas as não conformidades de {id} foram corrigidas? O resultado original da
          inspeção mantém-se no histórico.
        </p>
        <p>Serão informados de que o elevador está pronto para ser novamente inspecionado:</p>
        <ul>
          <li>{e.owner} — proprietário</li>
          <li>Câmara Municipal de Aveiro</li>
          <li>{e.inspector} — empresa de inspeção</li>
        </ul>
      </>,
      () => {
        s.setFailed((items) =>
          items.map((f) => (f.elevator === id ? { ...f, resolved: true } : f)),
        );
        s.notify(
          'Correções comunicadas ao proprietário, à Câmara Municipal e à empresa de inspeção.',
        );
      },
      'Confirmar correção',
    );
  }

  return (
    <>
      <Heading
        title="Inspeções reprovadas"
        description={
          manager
            ? 'Acompanhar as correções e o processo de reinspeção.'
            : 'Acompanhe as correções pedidas e o estado da reinspeção.'
        }
      />
      <Panel>
        <div className="filters">
          <Tabs
            items={['Todas', 'Não corrigidas', 'Corrigidas']}
            value={status}
            onChange={setStatus}
            label="Correções"
          />
          <Search value={query} onChange={setQuery} />
          <button
            className="text-button clear-filters"
            onClick={() => {
              setQuery('');
              setStatus('Todas');
            }}
          >
            Limpar filtros
          </button>
        </div>
        <DataTable
          headers={[
            'Elevador / morada',
            'Reprovada em',
            'Prazo de correção',
            'Correções',
            'Reinspeção',
            'Relatório',
            ...(manager ? [] : ['Ação']),
          ]}
        >
          {rows.map((f) => {
            const e = s.elevators.find((e) => e.id === f.elevator)!;
            const active = s.requests.find(
              (r) => r.elevator === f.elevator && r.status !== 'Concluído',
            );
            const days = Math.ceil(
              (new Date(f.deadline + 'T12:00:00').getTime() -
                new Date(localToday() + 'T12:00:00').getTime()) /
                86400000,
            );

            return (
              <tr key={f.elevator}>
                <td>
                  <button
                    className="text-button"
                    aria-label={`Consultar ${e.id}`}
                    onClick={() => s.go(detailPage(s.route.role), e.id)}
                  >
                    {e.id}
                  </button>
                  <small>{e.address}</small>
                </td>
                <td>{formatDate(f.date)}</td>
                <td>
                  {formatDate(f.deadline)}
                  <small className={days < 0 ? 'danger-text' : ''}>
                    {days < 0
                      ? `${Math.abs(days)} dia(s) de atraso`
                      : days === 0
                        ? 'Termina hoje'
                        : `${days} dia(s) restantes`}
                  </small>
                </td>
                <td>
                  <Badge>{f.resolved ? 'Corrigida' : 'Não corrigida'}</Badge>
                </td>
                <td>
                  {f.resolved && active ? <Badge>{active.status}</Badge> : '—'}
                </td>
                <td>
                  <button
                    className="text-button"
                    aria-label={`Descarregar relatório ${e.id}`}
                    onClick={() => s.report(f.requestId || e.id, 'Reprovada')}
                  >
                    <Icon name="download" />
                    Descarregar relatório
                  </button>
                </td>
                {!manager && (
                  <td>
                    {!f.resolved ? (
                      <Button className="primary nowrap" onClick={() => corrected(f.elevator)}>
                        <span aria-hidden="true">✓</span> Corrigido
                      </Button>
                    ) : (
                      <span className="muted">Correção comunicada</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={manager ? 6 : 7}>
                <Empty />
              </td>
            </tr>
          )}
        </DataTable>
      </Panel>
    </>
  );
}
