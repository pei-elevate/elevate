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
    // biome-ignore lint/a11y/useSemanticElements: grupo de botões de filtro, não um formulário; um <fieldset> mudaria o HTML auditado
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
