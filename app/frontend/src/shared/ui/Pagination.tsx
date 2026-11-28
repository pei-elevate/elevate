import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/** Linhas por página nas listas da aplicação. */
export const PAGE_SIZE = 10;

/**
 * A página `page` (a contar de 1) de `items`. A página é ajustada ao intervalo válido, por isso
 * uma lista que encolhe (ex.: depois de filtrar) nunca fica numa página vazia.
 */
export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;

  return {
    page: current,
    pages,
    start,
    total: items.length,
    items: items.slice(start, start + size),
  };
}

/**
 * Números a mostrar nos botões: a primeira, a última e as vizinhas da atual; os saltos ficam
 * com «…». Ex.: página 5 de 9 → 1 … 4 5 6 … 9.
 */
export function pageNumbers(page: number, pages: number): (number | '…')[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);

  return shown.flatMap((n, i) => (i > 0 && n - shown[i - 1] > 1 ? ['…' as const, n] : [n]));
}

export type PaginationState = ReturnType<typeof paginate> & { setPage: (page: number) => void };

/**
 * Paginação no cliente de uma lista já carregada. Volta à primeira página quando `reset` muda
 * (por exemplo, a pesquisa ou o separador escolhido).
 */
export function usePagination<T>(items: T[], { size = PAGE_SIZE, reset = '' } = {}) {
  const [page, setPage] = useState(1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset é o gatilho para voltar ao início
  useEffect(() => {
    setPage(1);
  }, [reset]);

  return { ...paginate(items, page, size), setPage };
}

/**
 * Paginação para quem não pode chamar o hook (ex.: tabelas montadas depois de um `return`
 * antecipado): entrega as linhas da página atual e a navegação, num rodapé próprio.
 */
export function Paged<T>({
  items,
  size,
  reset,
  children,
}: {
  items: T[];
  size?: number;
  reset?: string;
  children: (visible: T[], navigation: ReactNode) => ReactNode;
}) {
  const pages = usePagination(items, { size, reset });

  return <>{children(pages.items, <Pagination pagination={pages} footer />)}</>;
}

/**
 * Navegação entre páginas. Não aparece quando a lista cabe numa só página. `footer` põe-na num
 * rodapé próprio, para as listas que ainda não têm um.
 */
export function Pagination({
  pagination: { page, pages, start, total, items, setPage },
  footer = false,
}: {
  pagination: PaginationState;
  footer?: boolean;
}) {
  if (pages <= 1) return null;

  const nav = (
    <nav className="pagination" aria-label="Paginação">
      <span className="pagination-range">
        {start + 1}–{start + items.length} de {total}
      </span>
      <button
        type="button"
        className="pagination-button"
        aria-label="Página anterior"
        onClick={() => setPage(page - 1)}
        disabled={page === 1}
      >
        <Chevron direction="left" />
      </button>
      {pageNumbers(page, pages).map((n, i) =>
        n === '…' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: os saltos não têm identidade própria
          <span key={`gap-${i}`} className="pagination-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            type="button"
            key={n}
            className="pagination-button page"
            aria-label={`Página ${n}`}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => setPage(n)}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        className="pagination-button"
        aria-label="Página seguinte"
        onClick={() => setPage(page + 1)}
        disabled={page === pages}
      >
        <Chevron direction="right" />
      </button>
    </nav>
  );

  return footer ? <div className="panel-footer pagination-footer">{nav}</div> : nav;
}

/** Seta das páginas anterior e seguinte, na cor do texto do botão. */
function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={direction === 'left' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
