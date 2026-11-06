import { ComplaintForm } from '@/features/complaints/ComplaintForm';
import { ComplaintsPage } from '@/features/complaints/ComplaintsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ElevatorDetailsPage } from '@/features/elevators/ElevatorDetailsPage';
import { ElevatorsPage } from '@/features/elevators/ElevatorsPage';
import { RegisterElevatorForm } from '@/features/elevators/RegisterElevatorForm';
import { ValidateRegistrationPage } from '@/features/elevators/ValidateRegistrationPage';
import { FailedInspectionsPage } from '@/features/inspections/FailedInspectionsPage';
import { InspectionResultForm } from '@/features/inspections/InspectionResultForm';
import { InspectionsPage } from '@/features/inspections/InspectionsPage';
import { ScheduleInspectionForm } from '@/features/inspections/ScheduleInspectionForm';
import { SchedulePage } from '@/features/inspections/SchedulePage';
import { NewPermitForm } from '@/features/permits/NewPermitForm';
import { PermitsPage } from '@/features/permits/PermitsPage';
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

  if (p === 'registar') return <RegisterElevatorForm />;

  if (p === 'novo-aviso') return <NewPermitForm />;

  if (p === 'reclamacao') return <ComplaintForm />;

  if (p === 'agendar') return <ScheduleInspectionForm />;

  if (p === 'resultado') return <InspectionResultForm />;

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
