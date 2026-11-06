import type { ReactNode } from 'react';

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
