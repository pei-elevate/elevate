import { type CSSProperties, useEffect, useId, useRef, useState } from 'react';
import {
  Badge,
  badgeTone,
  Banner,
  Button,
  DataTable,
  Empty,
  Heading,
  Icon,
  Metric,
  Panel,
  Summary,
  Tabs,
} from './components';
import {
  decideRegistration,
  defaultElevatorFilters,
  elevatorHistory,
  filterElevators,
  formatDate,
  localToday,
  normalize,
  sendManualNotice,
} from './data';
import type { Elevator, ElevatorFilters, ElevatorNotice, Request, UrbanNotice } from './data';
import { PrototypeForm } from './forms';
import { usePrototype } from './state';

function Search({
  value,
  onChange,
  placeholder = 'Referência, morada ou entidade',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(value !== '');
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const close = () => {
    onChange('');
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div className={`expandable-search${open ? ' open' : ''}`}>
      <button
        ref={button}
        type="button"
        className="search-toggle"
        aria-label="Pesquisar"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="search-field" inert={!open}>
        <label>
          <span className="sr-only">Pesquisar</span>
          <input
            ref={input}
            id={id}
            type="search"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && close()}
            onBlur={(e) => {
              if (!value && e.relatedTarget !== button.current) setOpen(false);
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            className="search-clear"
            aria-label="Apagar pesquisa"
            onClick={() => {
              onChange('');
              input.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="filter">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function detailPage(role: string) {
  return role === 'gestor' ? 'historico' : 'detalhes';
}

// No painel do proprietário, guardar a origem para os detalhes oferecerem o regresso ao painel.
function dashboardOrigin(role: string, page: string) {
  return role === 'proprietario' && page === 'painel'
    ? { page: 'painel', label: 'Painel geral' }
    : null;
}

function ElevatorTable({
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

function InspectionCalendar({
  items,
  month,
  setMonth,
}: {
  items: Elevator[];
  month: string;
  setMonth: (value: string) => void;
}) {
  const s = usePrototype();
  const today = localToday();
  const [day, setDay] = useState('');
  const [flash, setFlash] = useState({ date: '', n: 0 });
  const [months, setMonths] = useState(false);
  const [dir, setDir] = useState<'up' | 'down'>('down');
  const ref = useRef<HTMLDivElement>(null);
  const first = new Date(month + 'T12:00:00');
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const label = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(first);
  const year = month.slice(0, 4);
  const all = [
    ...s.requests
      .filter((r) => r.status === 'Agendado' && items.some((e) => e.id === r.elevator))
      .map((r) => ({
        date: r.scheduled.slice(0, 10),
        elevator: r.elevator,
        title: `${r.scope} agendada às ${r.scheduled.slice(11)}`,
        status: r.status,
      })),
    ...items
      .filter((e) => e.validUntil)
      .map((e) => ({
        date: e.validUntil,
        elevator: e.id,
        title: 'Fim do certificado',
        status: e.status,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const events = all.filter((e) => e.date.startsWith(month.slice(0, 7)));
  const shown = day ? events.filter((e) => e.date === day) : events;

  useEffect(() => {
    // Um clique numa zona sem ação do cartão volta a mostrar o mês inteiro.
    const card = ref.current?.closest('.panel');
    if (!card) return;
    function reset(e: Event) {
      if (!(e.target as Element).closest('button, a, input, select, textarea, label')) setDay('');
    }
    card.addEventListener('click', reset);
    return () => card.removeEventListener('click', reset);
  }, []);

  function move(step: number) {
    const d = new Date(first.getFullYear(), first.getMonth() + (months ? step * 12 : step), 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    setDay('');
    setDir(step > 0 ? 'up' : 'down');
  }

  function open(value: string) {
    setMonth(value);
    setMonths(false);
  }

  return (
    <div className="calendar" ref={ref}>
      <div className="calendar-nav">
        <button
          className="text-button"
          aria-label={months ? 'Ano anterior' : 'Mês anterior'}
          onClick={() => move(-1)}
        >
          ‹
        </button>
        <h3 aria-live="polite">
          {months ? (
            year
          ) : (
            <button
              className="calendar-title"
              aria-label={`${label}, ver os meses de ${year}`}
              onClick={() => setMonths(true)}
            >
              {label[0].toUpperCase() + label.slice(1)}
            </button>
          )}
        </h3>
        <button
          className="text-button"
          aria-label={months ? 'Ano seguinte' : 'Mês seguinte'}
          onClick={() => move(1)}
        >
          ›
        </button>
      </div>
      {months ? (
        <div className="calendar-months">
          {Array.from({ length: 12 }, (_, i) => {
            const value = `${year}-${String(i + 1).padStart(2, '0')}-01`;
            const marks = all.filter((e) => e.date.startsWith(value.slice(0, 7)));
            const name = new Intl.DateTimeFormat('pt-PT', { month: 'long' }).format(
              new Date(value + 'T12:00:00'),
            );

            return (
              <button
                key={value}
                className={today.startsWith(value.slice(0, 7)) ? 'today' : ''}
                aria-pressed={value === month}
                aria-label={`${name} de ${year}${marks.length ? `, ${marks.length} ${marks.length > 1 ? 'eventos' : 'evento'}` : ''}`}
                onClick={() => open(value)}
              >
                {name[0].toUpperCase() + name.slice(1)}
                <span className="calendar-dots" aria-hidden="true">
                  {marks.map((e) => (
                    <i key={e.date + e.elevator + e.title} className={badgeTone(e.status)} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="calendar-grid" key={month} data-lift={dir}>
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
              <span key={d} aria-hidden="true">
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`vazio-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = month.slice(0, 8) + String(i + 1).padStart(2, '0');
              const marks = events.filter((e) => e.date === date);
              // As semanas chegam como andares, de cima para baixo.
              const floor = Math.floor((offset + i) / 7);

              return (
                <button
                  key={date === flash.date ? `${date}-${flash.n}` : date}
                  className={`${date === today ? 'today' : ''} ${date === flash.date ? 'flash' : ''}`}
                  aria-pressed={date === day}
                  aria-label={`${formatDate(date)}${marks.length ? `, ${marks.length} ${marks.length > 1 ? 'eventos' : 'evento'}` : ''}`}
                  onClick={() => setDay(date === day ? '' : date)}
                  style={{ '--floor': floor } as CSSProperties}
                >
                  {i + 1}
                  <span className="calendar-dots" aria-hidden="true">
                    {marks.map((e) => (
                      <i key={e.elevator + e.title} className={badgeTone(e.status)} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="calendar-events">
            {shown.map((e) => (
              <li key={e.date + e.elevator + e.title}>
                <button
                  className="calendar-event"
                  aria-label={`Mostrar ${formatDate(e.date)} no calendário`}
                  onClick={() => setFlash({ date: e.date, n: flash.n + 1 })}
                >
                  <time>{formatDate(e.date)}</time>
                  <span>
                    <strong>
                      {e.elevator} · {e.title}
                    </strong>
                    <small>{items.find((i) => i.id === e.elevator)?.address}</small>
                  </span>
                </button>
                <Badge>{e.status}</Badge>
              </li>
            ))}
            {!shown.length && (
              <li className="calendar-empty">
                <Empty>{day ? 'Sem eventos neste dia.' : 'Sem eventos neste mês.'}</Empty>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

export function Dashboard() {
  const s = usePrototype();
  const owner = s.route.role === 'proprietario';
  const items = owner
    ? s.elevators.filter((e) => e.owner === 'Condomínio Edifício Ria')
    : s.elevators;
  // A vista fica no modelo para se manter ao voltar dos detalhes.
  const saved = s.dashboardView[s.route.role] || {
    view: 'Tabela',
    month: localToday().slice(0, 7) + '-01',
  };
  const { view, month } = saved;
  const update = (changes: Partial<typeof saved>) =>
    s.setDashboardView((previous) => ({
      ...previous,
      [s.route.role]: { ...saved, ...changes },
    }));
  const setView = (value: string) => update({ view: value });
  const count = (state: string) => items.filter((e) => e.status === state).length;
  const viewTabs = (
    <Tabs items={['Tabela', 'Calendário']} value={view} onChange={setView} label="Vista" />
  );

  return (
    <>
      <Heading
        title="Painel geral"
        description={
          owner
            ? 'Visão geral dos seus elevadores e pedidos de inspeção.'
            : 'Visão geral dos elevadores e inspeções do município.'
        }
      />
      {owner && (
        <Banner
          tone="warning"
          action={
            <Button
              className="primary"
              onClick={() => {
                const notice = s.elevatorNotices.find((n) => n.id === 'AV-001');
                const elevator = s.elevators.find((e) => e.id === notice?.elevator);
                if (notice && elevator) s.setModal(noticeModal(elevator, notice));
              }}
            >
              Ver aviso <Icon name="arrow" />
            </Button>
          }
        >
          <strong>Inspeção a vencer — 01.05.0079</strong>
          <p>
            O certificado termina a 12/12/2026. Consulte o aviso dirigido a si e à sua empresa de
            manutenção.
          </p>
        </Banner>
      )}
      <section className="metrics" aria-label="Indicadores">
        {owner ? (
          <>
            <Metric
              label="Elevadores registados"
              value={items.length}
              description="Sob a sua propriedade"
            />
            <Metric
              label="Inspeções válidas"
              value={count('Válida')}
              description="Certificado em vigor"
              tone="green"
            />
            <Metric
              label="A vencer"
              value={count('A vencer')}
              description="Prazo próximo do fim"
              tone="yellow"
            />
            <Metric
              label="Em atraso"
              value={count('Em atraso')}
              description="Certificado caducado"
              tone="red"
            />
          </>
        ) : (
          <>
            <Metric
              label="Validações pendentes"
              value={s.registrations.filter((r) => r.status === 'Por validar').length}
              description="Registos para analisar"
              tone="green"
            />
            <Metric
              label="A vencer"
              value={count('A vencer')}
              description="Prazo próximo do fim"
              tone="yellow"
            />
            <Metric
              label="Inspeções em atraso"
              value={count('Em atraso')}
              description="Certificado caducado"
              tone="red"
            />
            <Metric
              label="Inspeções reprovadas"
              value={count('Reprovada')}
              description="Necessitam de intervenção"
              tone="red"
            />
          </>
        )}
      </section>
      <Panel
        title={owner ? 'Os meus elevadores' : 'Elevadores'}
        tools={
          <div className="panel-tools">
            {viewTabs}
            <button
              className="text-button"
              onClick={() => s.go(owner ? 'elevadores' : 'cadastro')}
            >
              Ver todos os elevadores <Icon name="arrow" />
            </button>
          </div>
        }
      >
        {view === 'Calendário' ? (
          <InspectionCalendar
            items={items}
            month={month}
            setMonth={(value) => update({ month: value })}
          />
        ) : (
          <ElevatorTable items={owner ? items : items.slice(0, 5)} compact={!owner} />
        )}
      </Panel>
      {owner && (
        <div className="request-cards">
          {s.requests
            .filter((r) => items.some((e) => e.id === r.elevator))
            .map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
        </div>
      )}
    </>
  );
}

function RequestCard({ request: r }: { request: Request }) {
  const s = usePrototype();
  const complete = r.status === 'Concluído';
  const current = complete ? 3 : r.status === 'Agendado' ? 2 : r.status === 'Por agendar' ? 1 : 0;

  return (
    <Panel className="request-card">
      <div className="request-title">
        <div>
          <h2>Processo n.º {r.id}</h2>
          <p>
            {r.elevator} · {r.scope}
          </p>
        </div>
        <Badge>{r.status}</Badge>
      </div>
      <ol className="stepper">
        {['Submetido', 'Validado', 'Agendado', 'Concluído'].map((step, i) => (
          <li
            className={i <= current ? 'done' : ''}
            key={step}
            aria-current={i === current ? 'step' : undefined}
          >
            <span>{i < current || complete ? '✓' : i + 1}</span>
            <strong>{step}</strong>
            <small>
              {i === 0 ? formatDate(r.date) : i === 2 && r.scheduled ? formatDate(r.scheduled) : ''}
            </small>
          </li>
        ))}
      </ol>
      <div className="result-box">
        <div>
          <small>{complete ? 'Resultado' : 'Data da inspeção'}</small>
          {complete ? (
            <Badge>{r.result}</Badge>
          ) : (
            <strong>
              {r.scheduled
                ? `${formatDate(r.scheduled)}, ${r.scheduled.slice(11)}`
                : 'A aguardar agendamento'}
            </strong>
          )}
        </div>
        {complete ? (
          <button
            className="text-button"
            onClick={() => s.report(r.id, r.result, undefined, true)}
          >
            <Icon name="download" />
            Descarregar relatório
          </button>
        ) : (
          <div>
            <small>Resultado</small>
            <strong>Disponível após a inspeção</strong>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function Elevators() {
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
  const base = owner
    ? s.elevators.filter((e) => e.owner === 'Condomínio Edifício Ria')
    : manager
      ? s.elevators
      : s.elevators.filter((e) => e.company === 'Elevar, Lda.');
  const items = filterElevators(base, query, status).filter(
    (e) =>
      (parish === 'Todas' || e.parish === parish) &&
      (company === 'Todas' || e.company === company) &&
      (year === 'Todos' || e.entryDate.startsWith(year)),
  );
  const clear = () => updateFilters(defaultElevatorFilters);
  const pending = s.registrations.filter((r) => r.company === 'Elevar, Lda.');

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
        <ElevatorTable items={items} registry={manager} />
        <div className="panel-footer">
          <span>
            {items.length} de {base.length} elevadores
          </span>
        </div>
      </Panel>
      {!owner && !manager && pending.length > 0 && (
        <Panel title="Registos submetidos">
          {pending.map((r) => (
            <div className="pending-row" key={r.id}>
              <div>
                <strong>{r.address}</strong>
                <small>{r.owner}</small>
              </div>
              <Badge>{r.status}</Badge>
              <span>
                {r.reason ||
                  (r.status === 'Por validar'
                    ? 'A aguardar referência interna'
                    : 'Registo analisado pelo município')}
              </span>
              {r.status === 'Rejeitado' && s.route.role === 'manutencao' && (
                <Button onClick={() => s.go('registar', r.id)}>Corrigir e voltar a submeter</Button>
              )}
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}

export function Details() {
  const s = usePrototype();
  const e = s.elevators.find((e) => e.id === s.route.id);
  const [tab, setTab] = useState('Inspeções');

  if (!e)
    return (
      <>
        <Heading title="Elevador não encontrado" />
        <Button onClick={() => s.go(s.route.role === 'gestor' ? 'cadastro' : 'elevadores')}>
          Voltar aos elevadores
        </Button>
      </>
    );

  const manager = s.route.role === 'gestor',
    owner = s.route.role === 'proprietario';
  const history = elevatorHistory(e.id, s.requests);
  const notices = s.elevatorNotices.filter((n) => n.elevator === e.id);

  function sendNotice(elevator: Elevator) {
    s.confirm(
      'Enviar aviso de inspeção',
      `Enviar um aviso de necessidade de inspeção do ${elevator.id} a ${elevator.owner} (proprietário) e a ${elevator.company} (empresa de manutenção)? Neste protótipo não será enviado correio eletrónico.`,
      () => {
        s.setElevatorNotices((items) => sendManualNotice(items, elevator));
        setTab('Avisos');
        s.notify('Aviso de necessidade de inspeção enviado.');
      },
      'Enviar aviso',
    );
  }

  const inspectionTable = (
    <DataTable
      headers={[
        'N.º de processo',
        'Data do processo',
        'Âmbito',
        'Empresa de inspeção',
        'Data da inspeção',
        'Resultado',
        'Relatório',
      ]}
    >
      {history.map((h) => (
        <tr key={h.entry}>
          <td>
            <strong>{h.entry}</strong>
          </td>
          <td>{formatDate(h.date)}</td>
          <td>{h.scope}</td>
          <td>{e.inspector}</td>
          <td>{formatDate(h.performed)}</td>
          <td>
            <Badge>{h.result}</Badge>
          </td>
          <td>
            <button
              className="text-button"
              aria-label={`Descarregar relatório ${h.entry}`}
              onClick={() => s.report(h.entry, h.result)}
            >
              <Icon name="download" />
              Descarregar relatório
            </button>
          </td>
        </tr>
      ))}
      {!history.length && (
        <tr>
          <td colSpan={7}>
            <Empty>Ainda não há inspeções concluídas para este elevador.</Empty>
          </td>
        </tr>
      )}
    </DataTable>
  );

  const noticeTable = (
    <DataTable headers={['Data', 'Tipo', 'Assunto', 'Destinatários', 'Ofício']}>
      {notices.map((n) => (
        <tr key={n.id}>
          <td>{formatDate(n.date)}</td>
          <td>{n.type}</td>
          <td>{n.subject}</td>
          <td>{n.recipients}</td>
          <td>
            <button
              className="text-button"
              aria-label={`Ver ofício ${n.id}`}
              onClick={() => s.setModal(noticeModal(e, n))}
            >
              Ver ofício <Icon name="arrow" />
            </button>
          </td>
        </tr>
      ))}
      {!notices.length && (
        <tr>
          <td colSpan={5}>
            <Empty>Sem avisos enviados.</Empty>
          </td>
        </tr>
      )}
    </DataTable>
  );

  const complaintTable = (
    <DataTable headers={['Recebida em', 'Descrição', 'Respondida em', 'Estado']}>
      {s.complaints
        .filter((c) => c.elevator === e.id)
        .map((c) => (
          <tr key={c.id}>
            <td>{formatDate(c.received)}</td>
            <td>{c.description}</td>
            <td>{formatDate(c.responded || '')}</td>
            <td>
              <Badge>{c.status}</Badge>
            </td>
          </tr>
        ))}
      {!s.complaints.some((c) => c.elevator === e.id) && (
        <tr>
          <td colSpan={4}>
            <Empty>Sem reclamações registadas.</Empty>
          </td>
        </tr>
      )}
    </DataTable>
  );

  return (
    <>
      <div className="breadcrumb">
        {s.origin ? (
          <button onClick={() => s.go(s.origin!.page)}>{s.origin.label}</button>
        ) : (
          <button onClick={() => s.go(manager ? 'cadastro' : 'elevadores')}>
            {manager
              ? 'Elevadores registados'
              : s.route.role === 'manutencao'
                ? 'Painel geral'
                : owner
                  ? 'Os meus elevadores'
                  : 'Elevadores'}
          </button>
        )}
        <span>/</span>
        <span>{e.id}</span>
      </div>
      <Heading
        title={`Elevador ${e.id}`}
        description={`${e.owner} · ${e.address}, Aveiro`}
        status={e.status}
        onBack={() => s.back(s.origin?.page || (manager ? 'cadastro' : 'elevadores'))}
        action={
          manager && (
            <Button className="primary" onClick={() => sendNotice(e)}>
              Enviar aviso de inspeção
            </Button>
          )
        }
      />
      <Panel title={manager || owner ? 'Elevador' : undefined}>
        <Summary
          items={[
            ['Referência interna', e.id],
            ['N.º DGE', e.dge],
            ['Entidade', e.owner],
            ['Morada', e.address],
            ['Empresa de manutenção (EMA)', e.company],
            ['Empresa de inspeção', e.inspector],
            ['Última entrada', `${e.entry} · ${formatDate(e.entryDate)}`],
            ['Válido até', formatDate(e.validUntil)],
          ]}
        />
      </Panel>
      {manager || owner ? (
        <Panel
          title="Histórico"
          tools={
            <Tabs
              items={['Inspeções', 'Avisos', 'Reclamações']}
              value={tab}
              onChange={setTab}
              label="Histórico a mostrar"
            />
          }
        >
          {tab === 'Avisos' ? noticeTable : tab === 'Reclamações' ? complaintTable : inspectionTable}
        </Panel>
      ) : (
        <>
          <Panel title="Histórico de inspeções">{inspectionTable}</Panel>
          <Panel title="Histórico de reclamações">{complaintTable}</Panel>
        </>
      )}
    </>
  );
}

const manualNoticeBody =
  'A Câmara Municipal de Aveiro identificou a necessidade de inspeção do elevador abaixo identificado. O pedido de inspeção é apresentado na plataforma externa utilizada pelo município. No Elevate pode acompanhar o pedido, o agendamento e o resultado da inspeção.';

function expiringNoticeBody(validUntil: string) {
  return `O certificado de inspeção do elevador abaixo identificado termina a ${formatDate(validUntil)}. O pedido de inspeção periódica deve ser apresentado com a antecedência indicada no aviso. O pedido é apresentado na plataforma externa utilizada pelo município. No Elevate pode acompanhar o pedido, o agendamento e o resultado da inspeção.`;
}

// Janela com o ofício de um aviso, aberta no painel e no histórico do elevador.
function noticeModal(elevator: Elevator, n: ElevatorNotice) {
  return {
    title: `Aviso ${n.id}`,
    body: (
      <div className="official-notice">
        <OfficialLetter
          date={n.date}
          subject={n.type === 'Manual' ? n.subject : 'Prazo da inspeção periódica'}
          body={n.type === 'Manual' ? manualNoticeBody : expiringNoticeBody(elevator.validUntil)}
          elevator={elevator}
        />
      </div>
    ),
  };
}

// Ofício da Câmara, mostrado na janela de um aviso.
function OfficialLetter({
  date,
  subject,
  body,
  elevator,
}: {
  date: string;
  subject: string;
  body: string;
  elevator: Elevator;
}) {
  return (
    <>
      <div className="letter-header">
        <strong>CÂMARA MUNICIPAL DE AVEIRO</strong>
        <h2>Ofício</h2>
        <p>Ref. OF-2026-0412 · {formatDate(date)}</p>
      </div>
      <p>
        <strong>Para:</strong> {elevator.owner}
        <br />
        <strong>Conhecimento:</strong> {elevator.company} — empresa de manutenção
      </p>
      <h3>
        {subject} — {elevator.id}
      </h3>
      <p>{body}</p>
      <Summary
        items={[
          ['Referência interna', elevator.id],
          ['N.º DGE', elevator.dge],
          ['Morada', elevator.address],
          ['Empresa de manutenção', elevator.company],
          ['Certificado válido até', formatDate(elevator.validUntil)],
        ]}
      />
    </>
  );
}

function RequestTable({
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

export function Inspections() {
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

// Ponto de partida do menu «Agendar»: os pedidos que ainda não têm data.
function Schedule() {
  const s = usePrototype();
  const items = s.requests.filter((r) => r.status === 'Por agendar');

  return (
    <>
      <Heading
        title="Agendar inspeções"
        description="Escolha um pedido e defina a data e a hora da inspeção."
      />
      <Panel>
        <RequestTable items={items} assigned />
        <div className="panel-footer">
          <span>{items.length} pedido(s)</span>
        </div>
      </Panel>
    </>
  );
}

export function Failed() {
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

export function Complaints() {
  const s = usePrototype();
  const maintenance = s.route.role === 'manutencao';
  const [status, setStatus] = useState('Todas');
  const [query, setQuery] = useState('');
  const items = s.complaints.filter((complaint) => {
    const elevator = s.elevators.find((e) => e.id === complaint.elevator);
    return (
      elevator?.company === 'Elevar, Lda.' &&
      (status === 'Todas' || complaint.status === status) &&
      normalize(`${complaint.elevator} ${elevator.address} ${complaint.description}`).includes(
        normalize(query),
      )
    );
  });

  return (
    <>
      <Heading
        title="Reclamações"
        description={
          maintenance
            ? 'Problemas comunicados pelos residentes nos elevadores que mantém.'
            : 'Consulta das reclamações. A resolução pertence à EMA.'
        }
      />
      <Panel>
        <div className="filters">
          <Tabs
            items={['Todas', 'Aberta', 'Resolvida']}
            value={status}
            onChange={setStatus}
            label="Estado da reclamação"
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
          {maintenance && (
            <Button className="add-button" onClick={() => s.go('reclamacao')}>
              <span aria-hidden="true">+</span> Registar nova reclamação
            </Button>
          )}
        </div>
        <DataTable headers={['Elevador / morada', 'Recebida em', 'Descrição', 'Estado', 'Ação']}>
          {items.map((complaint) => (
            <tr key={complaint.id}>
              <td>
                <strong>{complaint.elevator}</strong>
                <small>{s.elevators.find((e) => e.id === complaint.elevator)?.address}</small>
              </td>
              <td>{formatDate(complaint.received)}</td>
              <td className="description-cell">{complaint.description}</td>
              <td>
                <Badge>{complaint.status}</Badge>
              </td>
              <td>
                {s.canResolveComplaint(complaint.id) ? (
                  <Button onClick={() => s.resolveComplaint(complaint.id)}>
                    Assinalar como resolvida
                  </Button>
                ) : complaint.responded ? (
                  formatDate(complaint.responded)
                ) : (
                  'A aguardar resolução pela EMA'
                )}
              </td>
            </tr>
          ))}
          {!items.length && (
            <tr>
              <td colSpan={5}>
                <Empty>Altere os filtros para encontrar outras reclamações.</Empty>
              </td>
            </tr>
          )}
        </DataTable>
        <div className="panel-footer">{items.length} reclamação(ões)</div>
      </Panel>
    </>
  );
}

export function Unregistered() {
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

export function Validate() {
  const s = usePrototype();
  const pending = s.registrations.filter((r) => r.status === 'Por validar');
  const [selected, setSelected] = useState(s.route.id || pending[0]?.id || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [association, setAssociation] = useState<string | null>(null);
  const reg = pending.find((r) => r.id === selected) || pending[0];

  function decide(approve: boolean) {
    if (!reg) return;

    if (!approve && !reason.trim()) {
      setError('Indique o motivo da rejeição.');
      document.getElementById('reason')?.focus();

      return;
    }

    s.confirm(
      approve ? 'Aprovar registo' : 'Rejeitar registo',
      approve
        ? 'Aprovar os dados e atribuir uma referência interna ao elevador?'
        : `Motivo: ${reason.trim()}`,
      () => {
        const next = decideRegistration(
          { registrations: s.registrations, elevators: s.elevators, urbanNotices: s.urbanNotices },
          reg.id,
          approve,
          reason,
          association ?? reg.permit,
        );
        s.setRegistrations(next.registrations);
        s.setElevators(next.elevators);
        s.setUrbanNotices(next.urbanNotices);
        if (approve)
          s.setModal({
            title: 'Registo aprovado',
            body: (
              <>
                <p>
                  O registo de {reg.address}, submetido por {reg.company}, foi aprovado.
                </p>
                <p>
                  <strong>Referência interna atribuída:</strong> {next.elevators.at(-1)?.id}
                </p>
              </>
            ),
          });
        else
          s.setModal({
            title: 'Registo rejeitado',
            body: (
              <>
                <p>
                  O registo de {reg.address}, submetido por {reg.company}, foi rejeitado.
                </p>
                <p>
                  <strong>Motivo:</strong> {reason.trim()}
                </p>
              </>
            ),
            tone: 'danger',
          });
        s.dirty.current = false;
        setReason('');
        setError('');
        setAssociation(null);
      },
      approve ? 'Aprovar e atribuir referência' : 'Rejeitar registo',
      approve ? undefined : 'danger',
    );
  }

  return (
    <>
      <Heading
        title="Validar registo"
        description="Registos submetidos pelas empresas de manutenção."
      />
      {!reg ? (
        <Panel>
          <Empty>Todos os registos foram analisados.</Empty>
        </Panel>
      ) : (
        <div className="split-panel">
          <Panel title={`Por validar (${pending.length})`} className="selection-list">
            {pending.map((r) => (
              <button
                key={r.id}
                className={`selection-item ${reg.id === r.id ? 'selected' : ''}`}
                aria-pressed={reg.id === r.id}
                onClick={() => {
                  if (s.dirty.current && !window.confirm('Descartar a decisão por guardar?'))
                    return;

                  s.dirty.current = false;
                  setSelected(r.id);
                  setReason('');
                  setError('');
                  setAssociation(null);
                }}
              >
                <strong>{r.address}</strong>
                <span>{r.company}</span>
              </button>
            ))}
          </Panel>
          <Panel className="validation-panel">
            <div className="panel-heading">
              <h2>{reg.address}</h2>
              <Badge>{reg.status}</Badge>
            </div>
            <div className="association">
              <label htmlFor="association">Alvará do Urbanismo associado</label>
              <small>Altere a associação se o registo corresponder a outro alvará.</small>
              <select
                id="association"
                value={association ?? reg.permit}
                onChange={(e) => {
                  setAssociation(e.target.value);
                  s.dirty.current = true;
                }}
              >
                <option value="">Sem alvará associado</option>
                {s.urbanNotices.map((n) => (
                  <option key={n.id} value={n.permit}>
                    {n.permit} — {n.address}
                  </option>
                ))}
              </select>
            </div>
            <Summary
              items={[
                ['Morada', `${reg.address}, ${reg.postal}, Aveiro`],
                ['Freguesia', reg.parish],
                ['Entidade', `${reg.owner} · NIF ${reg.nif}`],
                ['Contacto do proprietário', [reg.email, reg.phone].filter(Boolean).join(' · ')],
                ['N.º DGE', reg.dge || 'Por atribuir'],
                ['Empresa de manutenção', reg.company],
                ['Entrada em serviço', formatDate(reg.service)],
              ]}
            />
            {reg.document && (
              <div className="inset">
                <button
                  className="text-button"
                  onClick={() => s.report(reg.id, 'Documento de suporte', s.documents[reg.id])}
                >
                  <Icon name="download" />
                  {reg.document}
                </button>
              </div>
            )}
            <section className="decision">
              <h3>Decisão</h3>
              <label htmlFor="reason">Motivo (obrigatório em caso de rejeição)</label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                aria-invalid={!!error}
                aria-describedby={error ? 'reason-error' : undefined}
                placeholder="Ex.: O NIF não corresponde aos dados do edifício."
                onChange={(e) => {
                  setReason(e.target.value);
                  s.dirty.current = true;
                  setError('');
                }}
              />
              {error && (
                <p id="reason-error" className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button className="danger" onClick={() => decide(false)}>
                  Rejeitar
                </Button>
                <Button className="primary" onClick={() => decide(true)}>
                  Aprovar e atribuir referência
                </Button>
              </div>
            </section>
          </Panel>
        </div>
      )}
    </>
  );
}

export function Page() {
  const s = usePrototype();
  const p = s.route.page;

  if (p === 'painel') return <Dashboard />;

  if (p === 'elevadores' || p === 'cadastro') return <Elevators />;

  if (p === 'detalhes' || p === 'historico') return <Details />;

  if (p === 'avisos' && s.route.role === 'urbanismo') return <Unregistered />;

  if (p === 'inspecoes' || p === 'pedidos' || p === 'atribuidas') return <Inspections />;

  if (p === 'agendar' && !s.route.id) return <Schedule />;

  if (
    p === 'registar' ||
    p === 'novo-aviso' ||
    p === 'reclamacao' ||
    p === 'agendar' ||
    p === 'resultado'
  )
    return <PrototypeForm kind={p} />;

  if (p === 'reprovadas') return <Failed />;

  if (p === 'reclamacoes') return <Complaints />;

  if (p === 'nao-registados') return <Unregistered />;

  if (p === 'validacoes') return <Validate />;

  return (
    <>
      <Heading
        title="Página não encontrada"
        description="Este endereço não corresponde a um ecrã do protótipo."
      />
      <Button onClick={() => s.go('painel')}>Voltar ao início</Button>
    </>
  );
}
