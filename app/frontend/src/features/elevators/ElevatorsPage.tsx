import { ElevatorTable } from '@/features/elevators/ElevatorTable';
import { ElevatorsState } from '@/features/elevators/ElevatorsState';
import { registrationStatusLabels } from '@/features/elevators/registration';
import { RecentRequests } from '@/features/inspections/RecentRequests';
import { defaultElevatorFilters, filterElevators } from '@/features/elevators/rules';
import type { ElevatorFilters } from '@/features/elevators/types';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Metric } from '@/shared/ui/Metric';
import { Pagination, usePagination } from '@/shared/ui/Pagination';
import { Panel } from '@/shared/ui/Panel';
import { Search } from '@/shared/ui/Search';
import { Select } from '@/shared/ui/Select';
import { usePrototype } from '@/app/state';

export function ElevatorsPage() {
  const s = usePrototype();
  const filters = s.elevatorFilters[s.route.role] || defaultElevatorFilters;
  const { query, status, parish, company, year } = filters;
  const updateFilters = (changes: Partial<ElevatorFilters>) => {
    s.setElevatorFilters((previous) => ({
      ...previous,
      [s.route.role]: { ...defaultElevatorFilters, ...previous[s.route.role], ...changes },
    }));
  };
  const setQuery = (query: string) => updateFilters({ query });
  const setStatus = (status: string) => updateFilters({ status });
  const setParish = (parish: string) => updateFilters({ parish });
  const setCompany = (company: string) => updateFilters({ company });
  const setYear = (year: string) => updateFilters({ year });
  const owner = s.route.role === 'proprietario',
    manager = s.route.role === 'gestor';
  // O backend já só devolve os elevadores do perfil.
  const base = s.apiElevators ?? [];
  const items = filterElevators(base, query, status).filter(
    (e) =>
      (parish === 'Todas' || e.parish === parish) &&
      (company === 'Todas' || e.company === company) &&
      (year === 'Todos' || e.entryDate.startsWith(year)),
  );
  const clear = () => updateFilters(defaultElevatorFilters);
  // Só a empresa de manutenção os tem (o backend devolve apenas os que ela submeteu).
  const submitted = s.submittedRegistrations ?? [];
  const elevatorPages = usePagination(items, { reset: JSON.stringify(filters) });
  const submittedPages = usePagination(submitted);

  return (
    <>
      <Heading
        title={manager ? 'Elevadores registados' : owner ? 'Os meus elevadores' : 'Painel geral'}
        description={
          manager
            ? 'Todos os elevadores registados no município.'
            : owner
              ? 'Consulte os elevadores sob a sua propriedade.'
              : 'Elevadores abrangidos pelo seu contrato de manutenção.'
        }
      />
      {!owner && !manager && (
        <section className="metrics">
          <Metric label="Elevadores" value={base.length} description="Em manutenção" />
          {['A vencer', 'Em atraso', 'Reprovada'].map((st) => (
            <Metric
              key={st}
              tone={st === 'A vencer' ? 'yellow' : 'red'}
              label={st === 'Reprovada' ? 'Reprovados' : st}
              value={base.filter((e) => e.status === st).length}
              description={
                st === 'A vencer'
                  ? 'Prazo próximo do fim'
                  : st === 'Em atraso'
                    ? 'Certificado caducado'
                    : 'Necessitam de intervenção'
              }
            />
          ))}
        </section>
      )}
      <Panel
        title={manager || owner ? undefined : 'Todos os elevadores'}
        tools={
          owner ? (
            <Search value={query} onChange={setQuery} />
          ) : (
            !manager && (
              <>
                <Search value={query} onChange={setQuery} />
                <Button className="add-button" onClick={() => s.go('registar')}>
                  <span aria-hidden="true">+</span> Registar elevador
                </Button>
              </>
            )
          )
        }
      >
        {manager && (
          <div className="filters">
            <Select
              label="Estado"
              value={status}
              onChange={setStatus}
              options={['Todos', 'Válida', 'A vencer', 'Em atraso', 'Reprovada']}
            />
            <Select
              label="Freguesia"
              value={parish}
              onChange={setParish}
              options={['Todas', ...new Set(base.map((e) => e.parish))]}
            />
            <Select
              label="Ano do processo"
              value={year}
              onChange={setYear}
              options={['Todos', ...new Set(base.map((e) => e.entryDate.slice(0, 4)))]}
            />
            <Select
              label="Empresa de manutenção"
              value={company}
              onChange={setCompany}
              options={['Todas', ...new Set(base.map((e) => e.company))]}
            />
            <Search value={query} onChange={setQuery} />
            <button className="text-button clear-filters" onClick={clear}>
              Limpar filtros
            </button>
          </div>
        )}
        {s.apiElevators && !s.apiElevatorsError ? (
          <>
            <ElevatorTable items={elevatorPages.items} registry={manager} />
            <div className="panel-footer">
              <span>
                {items.length} de {base.length} elevadores
              </span>
              <Pagination pagination={elevatorPages} />
            </div>
          </>
        ) : (
          <ElevatorsState error={s.apiElevatorsError} onRetry={s.reloadApiElevators} />
        )}
      </Panel>
      {!owner && !manager && <RecentRequests page="inspecoes" />}
      {!owner && !manager && submitted.length > 0 && (
        <Panel title="Registos submetidos">
          {submittedPages.items.map((r) => (
            <div className="pending-row" key={r.id}>
              <div>
                <strong>{r.address}</strong>
                <small>{r.owner.name}</small>
              </div>
              <Badge>{registrationStatusLabels[r.registration_status]}</Badge>
              <span>
                {r.registration_status === 'rejected'
                  ? r.rejected_reason
                  : 'A aguardar referência interna'}
              </span>
              {r.registration_status === 'rejected' && (
                <Button onClick={() => s.go('registar', String(r.id))}>
                  Corrigir e voltar a submeter
                </Button>
              )}
            </div>
          ))}
          <Pagination pagination={submittedPages} footer />
        </Panel>
      )}
    </>
  );
}
