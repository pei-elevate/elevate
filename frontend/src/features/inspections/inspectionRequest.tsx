import type { ReactNode } from 'react';
import type { Elevator } from '@/features/elevators/types';
import type { Request } from '@/features/inspections/types';
import { usePrototype } from '@/app/state';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';
import { Summary } from '@/shared/ui/Summary';

/** Pedido de inspeção indicado no endereço e o respetivo elevador. */
export function useInspectionRequest() {
  const s = usePrototype();
  const request = s.requests.find((r) => r.id === s.route.id);
  const elevator = s.elevators.find((e) => e.id === request?.elevator);

  return { request, elevator };
}

/**
 * Ecrã a mostrar quando o pedido não pode ser tratado: perfil errado, pedido inexistente ou
 * estado já alterado. Devolve null quando o formulário pode ser mostrado.
 */
export function requestUnavailable(
  role: string,
  request: Request | undefined,
  elevator: Elevator | undefined,
  allowed: (status: string) => boolean,
  go: (page: string) => void,
): ReactNode | null {
  if (role !== 'inspecao') {
    return (
      <>
        <Heading title="Ação indisponível" />
        <Banner>Esta ação pertence à empresa de inspeção.</Banner>
      </>
    );
  }

  if (!request || !elevator)
    return (
      <>
        <Heading title="Pedido não encontrado" />
        <Button onClick={() => go('atribuidas')}>Voltar às inspeções atribuídas</Button>
      </>
    );

  if (!allowed(request.status))
    return (
      <>
        <Heading title="Ação indisponível" />
        <Banner>O estado deste pedido já foi alterado. Consulte a lista de inspeções.</Banner>
        <Button onClick={() => go('atribuidas')}>Voltar às inspeções atribuídas</Button>
      </>
    );

  return null;
}

export function RequestBreadcrumb({
  label,
  onBack,
  elevatorId,
}: {
  label: string;
  onBack: () => void;
  elevatorId?: string;
}) {
  return (
    <div className="breadcrumb">
      <button onClick={onBack}>{label}</button>
      <span>/</span>
      <span>{elevatorId}</span>
    </div>
  );
}

/** Painel «Dados do pedido», comum ao agendamento e ao resultado. */
export function RequestSummary({
  request,
  elevator,
  extra,
}: {
  request: Request;
  elevator: Elevator;
  extra: [string, string][];
}) {
  return (
    <Panel title="Dados do pedido">
      <Summary
        items={[
          ['N.º de processo', request.id],
          ['Referência interna', elevator.id],
          ['N.º DGE', elevator.dge],
          ['Morada', elevator.address],
          ['Âmbito', request.scope],
          ['Empresa de manutenção', elevator.company],
          ...extra,
        ]}
      />
    </Panel>
  );
}
