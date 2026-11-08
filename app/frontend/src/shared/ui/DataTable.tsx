import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

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
    // Região com foco para se poder deslocar a tabela com o teclado (padrão recomendado para
    // tabelas com scroll); trocar por <section> mudaria o HTML auditado.
    // biome-ignore lint/a11y/useSemanticElements: mantém o HTML auditado
    <div
      ref={ref}
      className={`table-scroll${stacked ? ' stacked' : ''}`}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: região de scroll acessível pelo teclado
      tabIndex={0}
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
