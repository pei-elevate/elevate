import { RequestTable } from '@/features/inspections/RequestTable';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';
import { usePrototype } from '@/app/state';

// Ponto de partida do menu «Agendar»: os pedidos atribuídos (da API) que ainda não têm data.
export function SchedulePage() {
  const s = usePrototype();
  const loading = !s.assignedRequests && !s.assignedError;
  const items = (s.assignedRequests ?? []).filter((r) => r.status === 'Por agendar');

  return (
    <>
      <Heading
        title="Agendar inspeções"
        description="Escolha um pedido e defina a data e a hora da inspeção."
      />
      {s.assignedError && (
        <Banner
          tone="warning"
          action={<Button onClick={s.reloadAssignedRequests}>Tentar novamente</Button>}
        >
          Não foi possível carregar os pedidos atribuídos.
        </Banner>
      )}
      <Panel>
        {loading ? (
          <p role="status">A carregar pedidos…</p>
        ) : (
          <RequestTable items={items} assigned />
        )}
        <div className="panel-footer">
          <span>{items.length} pedido(s)</span>
        </div>
      </Panel>
    </>
  );
}
