import { RequestTable } from '@/features/inspections/RequestTable';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';
import { usePrototype } from '@/app/state';

// Ponto de partida do menu «Agendar»: os pedidos que ainda não têm data.
export function SchedulePage() {
  const s = usePrototype();
  const items = s.requests.filter((r) => r.status === 'Por agendar');

  return (
    <>
      <Heading
        title="Agendar inspeções"
        description="Escolha um pedido e defina a data e a hora da inspeção."
      />
      <Panel>
        <RequestTable items={items} assigned />
        <div className="panel-footer">
          <span>{items.length} pedido(s)</span>
        </div>
      </Panel>
    </>
  );
}
