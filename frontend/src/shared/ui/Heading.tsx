import type { ReactNode } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';

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
