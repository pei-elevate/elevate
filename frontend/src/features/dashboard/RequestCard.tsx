import type { Request } from '@/features/inspections/types';
import { formatDate } from '@/shared/lib/dates';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Panel } from '@/shared/ui/Panel';
import { usePrototype } from '@/app/state';

export function RequestCard({ request: r }: { request: Request }) {
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
