import type { ReactNode } from 'react';

export function Empty({ children }: { children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>Sem resultados</strong>
      <p>{children || 'Não existem registos para apresentar.'}</p>
    </div>
  );
}
