import { useEffect, useId, useRef, useState } from 'react';

export function Search({
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
