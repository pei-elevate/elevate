import { useState } from 'react';
import { RequestTable } from '@/features/inspections/RequestTable';
import { formatDate } from '@/shared/lib/dates';
import { normalize } from '@/shared/lib/text';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
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
  // A empresa de inspeção vê os pedidos que lhe estão atribuídos; a empresa de manutenção e
  // o gestor, os que acompanham. Todos vêm da API.
  const loaded = assigned ? s.assignedRequests : s.trackedRequests;
  const error = assigned ? s.assignedError : s.trackedError;
  const loading = !loaded;
  const all = loaded ?? [];
  // Prazos da empresa de manutenção: os seus elevadores com o certificado a vencer.
  const deadlines = s.apiElevators?.filter((e) => e.status === 'A vencer');
  const items = all.filter(
    (r) =>
      (!maintenance || !['Agendado', 'Concluído'].includes(r.status)) &&
      // As inspeções concluídas ficam no histórico de cada elevador.
      (!manager || r.status !== 'Concluído') &&
      (status === 'Todos' || r.status === status) &&
      normalize(`${r.id} ${r.elevator} ${r.address ?? ''} ${r.company ?? ''}`).includes(
        normalize(query),
      ),
  );

  return (
    <>
      <Heading
        title={
          maintenance ? 'Inspeções' : assigned ? 'Inspeções atribuídas' : 'Pedidos de inspeção'
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
            {s.apiElevatorsError ? (
              <p>Não foi possível carregar os prazos.</p>
            ) : (
              !deadlines && <p role="status">A carregar prazos…</p>
            )}
            {deadlines?.map((e) => (
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
            {loading && !error && <p role="status">A carregar visitas…</p>}
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
                      {r.address} · {r.scheduled.slice(11)}
                    </p>
                    <small>{r.inspectionCompany}</small>
                  </div>
                </div>
              ))}
          </Panel>
        </div>
      )}
      {error && (
        <Banner
          tone="warning"
          action={
            <Button onClick={assigned ? s.reloadAssignedRequests : s.reloadTrackedRequests}>
              Tentar novamente
            </Button>
          }
        >
          {assigned
            ? 'Não foi possível carregar os pedidos atribuídos.'
            : 'Não foi possível carregar os pedidos de inspeção.'}
        </Banner>
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
        {loading && !error ? (
          <p role="status">A carregar pedidos…</p>
        ) : (
          <RequestTable items={items} assigned={assigned} open={maintenance} />
        )}
        <div className="panel-footer">
          <span>{items.length} pedido(s)</span>
        </div>
      </Panel>
    </>
  );
}
