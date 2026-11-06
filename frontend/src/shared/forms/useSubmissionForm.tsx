import { useRef, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Values } from '@/shared/forms/types';
import { formatDate, isISODate, parseDateInput } from '@/shared/lib/dates';

type FieldOptions = {
  type?: string;
  placeholder?: string;
  required?: boolean;
  options?: (string | { value: string; label: string })[];
  wide?: boolean;
  hint?: string;
  min?: string;
  max?: string;
};

export type FieldRenderer = (name: string, label: string, options?: FieldOptions) => ReactElement;

export type SubmissionForm = ReturnType<typeof useSubmissionForm>;

/**
 * Estado e comportamento comuns aos formulários: valores, erros, campos, anexo PDF,
 * validação com foco no primeiro campo inválido e gravação simulada.
 */
export function useSubmissionForm({
  initial,
  dirty,
  initialFile = null,
  initialDocument = '',
}: {
  initial: Values;
  /** Marca de alterações por guardar, usada para pedir confirmação ao sair. */
  dirty: { current: boolean };
  initialFile?: File | null;
  initialDocument?: string;
}) {
  const [values, setValues] = useState<Values>(initial);
  const [file, setFile] = useState<File | null>(initialFile);
  const [keptDocument, setKeptDocument] = useState(initialDocument);
  const fileInput = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Values>({});
  const [saving, setSaving] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  function change(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    dirty.current = true;

    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  }

  const field: FieldRenderer = (name, label, options = {}) => {
    const date = options.type === 'date';
    const hint = date
      ? [
          'Formato DD/MM/YYYY.',
          options.min ? `A partir de ${formatDate(options.min)}.` : '',
          options.max ? `Até ${formatDate(options.max)}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : options.hint;
    const props = {
      id: name,
      name,
      value: values[name] || '',
      required: options.required,
      'aria-invalid': !!errors[name],
      'aria-describedby': errors[name] ? `${name}-error` : hint ? `${name}-hint` : undefined,
      onChange: (e: { target: { value: string } }) => change(name, e.target.value),
    };

    return (
      <div className={`field ${options.wide ? 'wide' : ''}`} key={name}>
        <label htmlFor={name}>
          {label}
          {options.required && <span aria-hidden="true"> *</span>}
        </label>
        {options.options ? (
          <select {...props}>
            <option value="">Selecionar…</option>
            {options.options.map((o) => (
              <option
                key={typeof o === 'string' ? o : o.value}
                value={typeof o === 'string' ? o : o.value}
              >
                {typeof o === 'string' ? o : o.label}
              </option>
            ))}
          </select>
        ) : options.type === 'textarea' ? (
          <textarea {...props} rows={4} placeholder={options.placeholder} />
        ) : date ? (
          <input
            {...props}
            type="text"
            placeholder="DD/MM/YYYY"
            maxLength={10}
            value={isISODate(values[name] || '') ? formatDate(values[name]) : values[name] || ''}
            onChange={(e) => change(name, parseDateInput(e.target.value) || e.target.value)}
          />
        ) : (
          <input
            {...props}
            type={options.type || 'text'}
            placeholder={options.placeholder}
            min={options.min}
            max={options.max}
            inputMode={['nif', 'postal', 'phone'].includes(name) ? 'numeric' : undefined}
          />
        )}
        {errors[name] ? (
          <span id={`${name}-error`} className="field-error">
            {errors[name]}
          </span>
        ) : (
          hint && <small id={`${name}-hint`}>{hint}</small>
        )}
      </div>
    );
  };

  // O seletor só abre pelo botão; o campo de ficheiro fica escondido.
  // report: anexo obrigatório do resultado da inspeção (relatório ou certificado).
  const upload = (report = false) => (
    <div className="field wide">
      {report && (
        <span id="document-label" className="field-label">
          Relatório ou certificado da inspeção <span aria-hidden="true">*</span>
        </span>
      )}
      <p id="document-hint" className="field-hint">
        {report ? 'Relatório ou certificado assinado' : 'Contrato de manutenção ou outros documentos'}{' '}
        em PDF, até 10 MB.
      </p>
      <div className="file-picker">
        <input
          ref={fileInput}
          type="file"
          id="document"
          name="document"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            dirty.current = true;
            setErrors((v) => ({ ...v, document: '' }));
          }}
        />
        <button
          type="button"
          className="file-picker-button"
          aria-invalid={!!errors.document}
          aria-describedby={`${report ? 'document-label ' : ''}document-hint${errors.document ? ' document-error' : ''}`}
          onClick={() => fileInput.current?.click()}
        >
          {file || keptDocument ? 'Alterar ficheiro' : 'Escolher ficheiro'}
        </button>
        <span className="file-picker-name" title={file?.name || keptDocument} aria-live="polite">
          {file?.name || keptDocument || 'Nenhum ficheiro selecionado'}
        </span>
        {(file || keptDocument) && (
          <button
            type="button"
            className="remove-file"
            aria-label="Remover ficheiro"
            title="Remover ficheiro"
            onClick={() => {
              setFile(null);
              setKeptDocument('');
              if (fileInput.current) fileInput.current.value = '';
              dirty.current = true;
              setErrors((previous) => ({ ...previous, document: '' }));
            }}
          >
            ×
          </button>
        )}
      </div>
      {errors.document && (
        <span id="document-error" className="field-error">
          {errors.document}
        </span>
      )}
    </div>
  );

  /** Valida; com erros, mostra-os e põe o foco no primeiro campo inválido; sem erros, continua. */
  function submit(event: FormEvent, validate: () => Values, onValid: () => void) {
    event.preventDefault();

    if (saving) return;

    const next = validate();

    if (Object.keys(next).length) {
      setErrors(next);
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );

      return;
    }
    onValid();
  }

  /** Gravação simulada: espera um pouco, aplica as alterações e limpa a marca de alterações. */
  async function save(apply: () => void) {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    apply();
    dirty.current = false;
    setSaving(false);
  }

  return {
    values,
    setValues,
    errors,
    setErrors,
    file,
    keptDocument,
    saving,
    form,
    field,
    upload,
    submit,
    save,
  };
}
