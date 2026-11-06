import { ComplaintsPage } from '@/features/complaints/ComplaintsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ElevatorDetailsPage } from '@/features/elevators/ElevatorDetailsPage';
import { ElevatorsPage } from '@/features/elevators/ElevatorsPage';
import { ValidateRegistrationPage } from '@/features/elevators/ValidateRegistrationPage';
import { FailedInspectionsPage } from '@/features/inspections/FailedInspectionsPage';
import { InspectionsPage } from '@/features/inspections/InspectionsPage';
import { SchedulePage } from '@/features/inspections/SchedulePage';
import { PermitsPage } from '@/features/permits/PermitsPage';
import { PrototypeForm } from '@/forms';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { usePrototype } from '@/app/state';

export function Page() {
  const s = usePrototype();
  const p = s.route.page;

  if (p === 'painel') return <DashboardPage />;

  if (p === 'elevadores' || p === 'cadastro') return <ElevatorsPage />;

  if (p === 'detalhes' || p === 'historico') return <ElevatorDetailsPage />;

  if (p === 'avisos' && s.route.role === 'urbanismo') return <PermitsPage />;

  if (p === 'inspecoes' || p === 'pedidos' || p === 'atribuidas') return <InspectionsPage />;

  if (p === 'agendar' && !s.route.id) return <SchedulePage />;

  if (
    p === 'registar' ||
    p === 'novo-aviso' ||
    p === 'reclamacao' ||
    p === 'agendar' ||
    p === 'resultado'
  )
    return <PrototypeForm kind={p} />;

  if (p === 'reprovadas') return <FailedInspectionsPage />;

  if (p === 'reclamacoes') return <ComplaintsPage />;

  if (p === 'nao-registados') return <PermitsPage />;

  if (p === 'validacoes') return <ValidateRegistrationPage />;

  return (
    <>
      <Heading
        title="Página não encontrada"
        description="Este endereço não corresponde a um ecrã do protótipo."
      />
      <Button onClick={() => s.go('painel')}>Voltar ao início</Button>
    </>
  );
}
