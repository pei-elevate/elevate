import type { ReactNode } from 'react';

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
