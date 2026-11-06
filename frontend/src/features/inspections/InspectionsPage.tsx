import { useState } from 'react';
import { RequestTable } from '@/features/inspections/RequestTable';
import { formatDate } from '@/shared/lib/dates';
import { normalize } from '@/shared/lib/text';
import { Heading } from '@/shared/ui/Heading';
import { Metric } from '@/shared/ui/Metric';
import { Panel } from '@/shared/ui/Panel';
import { Search } from '@/shared/ui/Search';
import { Tabs } from '@/shared/ui/Tabs';
import { usePrototype } from '@/app/state';

export function InspectionsPage() {
  const s = usePrototype();
  const maintenance = s.route.role === 'manutencao',
    assigned = s.route.role === 'inspecao',
    manager = s.route.role === 'gestor';
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const all = s.requests.filter(
    (r) =>
      !maintenance || s.elevators.some((e) => e.id === r.elevator && e.company === 'Elevar, Lda.'),
  );
  const items = all.filter((r) => {
    const e = s.elevators.find((e) => e.id === r.elevator);

    return (
      (!maintenance || !['Agendado', 'Concluído'].includes(r.status)) &&
      // As inspeções concluídas ficam no histórico de cada elevador.
      (!manager || r.status !== 'Concluído') &&
      (status === 'Todos' || r.status === status) &&
      normalize(`${r.id} ${r.elevator} ${e?.address} ${e?.company}`).includes(normalize(query))
    );
  });

  return (
    <>
      <Heading
        title={
          maintenance
            ? 'Inspeções'
            : assigned
              ? 'Inspeções atribuídas'
              : 'Pedidos de inspeção'
        }
        description={
          maintenance
            ? 'Prazos, visitas agendadas e estado dos pedidos.'
            : assigned
              ? 'Pedidos de inspeção encaminhados pela Câmara Municipal de Aveiro.'
              : 'Acompanhar os pedidos desde a submissão até ao resultado.'
        }
      />
      {maintenance && (
        <div className="two-columns">
          <Panel title="Prazos próximos">
            {s.elevators
              .filter((e) => e.status === 'A vencer' && e.company === 'Elevar, Lda.')
              .map((e) => (
                <div className="deadline-row" key={e.id}>
                  <div>
                    <strong>{e.id}</strong>
                    <p>{e.address}</p>
                  </div>
                  <div>
                    <strong>{formatDate(e.validUntil)}</strong>
                    <small>Fim de validade do certificado</small>
                  </div>
                </div>
              ))}
          </Panel>
          <Panel title="Visitas agendadas">
            {all
              .filter((r) => r.status === 'Agendado')
              .map((r) => (
                <div className="scheduled-visit" key={r.id}>
                  <span className="calendar-day full-date">{formatDate(r.scheduled)}</span>
                  <div>
                    <strong>
                      {r.elevator} · {r.scope}
                    </strong>
                    <p>
                      {s.elevators.find((e) => e.id === r.elevator)?.address} ·{' '}
                      {r.scheduled.slice(11)}
                    </p>
                    <small>Inspeave, Lda.</small>
                  </div>
                </div>
              ))}
          </Panel>
        </div>
      )}
      {assigned && (
        <section className="metrics three">
          <Metric
            label="Por agendar"
            value={all.filter((r) => r.status === 'Por agendar').length}
            description="Definir data e hora"
            tone="yellow"
          />
          <Metric
            label="Agendadas"
            value={all.filter((r) => r.status === 'Agendado').length}
            description="A aguardar realização"
            tone="blue"
          />
          <Metric
            label="Concluídas"
            value={all.filter((r) => r.status === 'Concluído').length}
            description="Resultados submetidos"
            tone="green"
          />
        </section>
      )}
      <Panel
        title={assigned ? 'Lote ORD-2026-07' : maintenance ? 'Pedidos de inspeção' : undefined}
      >
        {!maintenance && (
          <div className="filters">
            <Tabs
              items={
                assigned
                  ? ['Todos', 'Por agendar', 'Agendado', 'Concluído']
                  : ['Todos', 'Por agendar', 'Agendado']
              }
              value={status}
              onChange={setStatus}
            />
            <Search value={query} onChange={setQuery} />
            <button
              className="text-button clear-filters"
              onClick={() => {
                setQuery('');
                setStatus('Todos');
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
        <RequestTable items={items} assigned={assigned} open={maintenance} />
        <div className="panel-footer">
          <span>{items.length} pedido(s)</span>
        </div>
      </Panel>
    </>
  );
}
