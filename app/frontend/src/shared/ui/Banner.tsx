import type { ReactNode } from 'react';

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
