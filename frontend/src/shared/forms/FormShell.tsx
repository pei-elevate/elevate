import type { FormEvent, ReactNode } from 'react';
import type { SubmissionForm } from '@/shared/forms/useSubmissionForm';
import { Button } from '@/shared/ui/Button';

/** Moldura comum: nota dos obrigatórios, alerta de erros, campos e botões Cancelar/Submeter. */
export function FormShell({
  form,
  title,
  onSubmit,
  onCancel,
  submitLabel,
  children,
}: {
  form: SubmissionForm;
  title: string;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="form-container">
      <form ref={form.form} noValidate onSubmit={onSubmit} aria-label={title}>
        <p className="required-note">Os campos assinalados com * são obrigatórios.</p>
        {Object.values(form.errors).some(Boolean) && (
          <div className="form-error" role="alert">
            Não foi possível guardar. Corrija os campos indicados abaixo.
          </div>
        )}
        <fieldset disabled={form.saving} className="form-body">
          {children}
          <div className="form-actions">
            <Button onClick={onCancel}>Cancelar</Button>
            <Button type="submit" className="primary" disabled={form.saving}>
              {form.saving ? 'A guardar…' : submitLabel}
            </Button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
