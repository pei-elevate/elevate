import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}

export function badgeTone(label: string) {
  return ['Válida', 'Aprovada', 'Resolvida', 'Corrigida', 'Registado'].includes(label)
    ? 'green'
    : ['Em atraso', 'Reprovada', 'Não corrigida', 'Rejeitado', 'Não registado'].includes(label)
      ? 'red'
      : ['A vencer', 'Por validar', 'Submetido', 'Aberta', 'Por agendar'].includes(label)
        ? 'yellow'
        : ['Agendado', 'Aviso', 'Reclamação'].includes(label)
          ? 'blue'
          : 'neutral';
}

export function Badge({ children }: { children: ReactNode }) {
  const tone = badgeTone(String(children));

  return (
    <span className={`badge ${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  description,
  tone = '',
}: {
  label: string;
  value: string | number;
  description: string;
  tone?: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </article>
  );
}

export function DataTable({
  headers,
  children,
  stacked = false,
}: {
  headers: string[];
  children: ReactNode;
  stacked?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Em ecrãs estreitos, cada linha passa a cartão e as células mostram o título da coluna.
  useEffect(() => {
    if (!stacked) return;
    ref.current?.querySelectorAll('tbody tr').forEach((row) =>
      [...row.children].forEach((cell, i) => {
        if (headers[i] && (cell as HTMLTableCellElement).colSpan === 1)
          cell.setAttribute('data-label', headers[i]);
      }),
    );
  });

  return (
    <div
      ref={ref}
      className={`table-scroll${stacked ? ' stacked' : ''}`}
      tabIndex={0}
      role="region"
      aria-label="Tabela de resultados"
    >
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} scope="col">
                {h || <span className="sr-only">Ações</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Panel({
  title,
  tools,
  children,
  className = '',
}: {
  title?: string;
  tools?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || tools) && (
        <div className="panel-heading">
          {title && <h2>{title}</h2>}
          {tools}
        </div>
      )}
      {children}
    </section>
  );
}

export function Heading({
  title,
  description,
  action,
  status,
  onBack,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  status?: string;
  onBack?: () => void;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="heading-title">
          <h1 tabIndex={-1}>{title}</h1>
          {status && <Badge>{status}</Badge>}
        </div>
        {description && <p>{description}</p>}
      </div>
      {(action || onBack) && (
        <div className="heading-actions">
          {action}
          {onBack && (
            <Button onClick={onBack}>
              <span aria-hidden="true">←</span> Voltar
            </Button>
          )}
        </div>
      )}
    </header>
  );
}

export function Summary({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="summary">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>Sem resultados</strong>
      <p>{children || 'Não existem registos para apresentar.'}</p>
    </div>
  );
}

export function Banner({
  children,
  tone = 'info',
  action,
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'success';
  action?: ReactNode;
}) {
  return (
    <div className={`banner ${tone}`}>
      <span className="banner-symbol" aria-hidden="true">
        {tone === 'warning' ? '!' : tone === 'success' ? '✓' : 'i'}
      </span>
      <div>{children}</div>
      {action}
    </div>
  );
}

export function Icon({ name }: { name: string }) {
  const files: Record<string, string> = {
    dashboard: 'imgFrame',
    elevators: 'imgFrame1',
    notices: 'imgFrame2',
    logout: 'imgFrame3',
    bell: 'imgFrame4',
    arrow: 'imgFrame6',
    download: 'imgFrame8',
    tick: 'imgFrame7',
    calendar: 'calendar',
    register: 'check',
    failed: 'failed',
    complaints: 'complaints',
    check: 'check',
  };

  return (
    <img
      className="icon"
      src={`/assets/${files[name] || 'imgFrame1'}.svg`}
      alt=""
      aria-hidden="true"
      width={20}
      height={20}
    />
  );
}

export function Tabs({
  items,
  value,
  onChange,
  label = 'Filtrar resultados',
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item}
          className={item === value ? 'active' : ''}
          aria-pressed={item === value}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
