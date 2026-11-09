import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** A tabela é mais larga do que a área visível, ou seja, a região tem scroll. */
export function hasOverflow(el: { scrollWidth: number; clientWidth: number }) {
  return el.scrollWidth > el.clientWidth;
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
  const [scrollable, setScrollable] = useState(false);

  // Só há scroll se a tabela transbordar; volta a medir quando a região ou a tabela mudam de tamanho.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScrollable(hasOverflow(el));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  // Em ecrãs estreitos, cada linha passa a cartão e as células mostram o título da coluna.
  useEffect(() => {
    if (!stacked) return;
    ref.current?.querySelectorAll('tbody tr').forEach((row) => {
      [...row.children].forEach((cell, i) => {
        if (headers[i] && (cell as HTMLTableCellElement).colSpan === 1)
          cell.setAttribute('data-label', headers[i]);
      });
    });
  });

  return (
    // Região com foco, só quando tem scroll, para se poder deslocar a tabela com o teclado
    // (padrão recomendado para tabelas com scroll); trocar por <section> mudaria o HTML auditado.
    // biome-ignore lint/a11y/useSemanticElements: mantém o HTML auditado
    <div
      ref={ref}
      className={`table-scroll${stacked ? ' stacked' : ''}`}
      tabIndex={scrollable ? 0 : undefined}
      role="region"
      aria-label="Tabela de resultados"
    >
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: cabeçalhos fixos, e o das ações é vazio
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
