import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';

/** Em vez da tabela, enquanto a lista da API carrega ou quando falhou. */
export function ElevatorsState({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  if (error)
    return (
      <Banner tone="warning" action={<Button onClick={onRetry}>Tentar de novo</Button>}>
        Não foi possível carregar os elevadores.
      </Banner>
    );

  return <p role="status">A carregar elevadores…</p>;
}
