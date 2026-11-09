import type { FormEvent } from 'react';
import { usePrototype } from '@/app/state';
import {
  RequestBreadcrumb,
  RequestSummary,
  requestUnavailable,
  useInspectionRequest,
} from '@/features/inspections/inspectionRequest';
import { updateSchedule } from '@/features/inspections/rules';
import { validateSchedule } from '@/features/inspections/validation';
import { FormShell } from '@/shared/forms/FormShell';
import { useSubmissionForm } from '@/shared/forms/useSubmissionForm';
import { formatDate, localToday } from '@/shared/lib/dates';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';

const title = 'Agendar inspeção';

export function ScheduleInspectionForm() {
  const s = usePrototype();
  const { request, elevator } = useInspectionRequest();
  const rescheduling = request?.status === 'Agendado';
  const form = useSubmissionForm({
    dirty: s.dirty,
    initial: {
      time: '09:00',
      ...(request?.scheduled
        ? { date: request.scheduled.slice(0, 10), time: request.scheduled.slice(11) }
        : {}),
    },
  });
  const { values, field } = form;
  const parent = rescheduling ? 'atribuidas' : 'agendar';
  const back = () => s.go(parent);

  function submit(event: FormEvent) {
    form.submit(
      event,
      () => validateSchedule(values, form.file),
      () => {
        if (rescheduling && request) {
          s.confirm(
            'Confirmar reagendamento',
            `Alterar a inspeção de ${formatDate(request.scheduled)}, ${request.scheduled.slice(11)} para ${formatDate(values.date)}, ${values.time}?`,
            () => {
              void saveSchedule();
            },
            'Confirmar reagendamento',
          );
          return;
        }
        void saveSchedule();
      },
    );
  }

  async function saveSchedule() {
    await form.save(() => {
      if (!request) return;
      s.setRequests((items) => updateSchedule(items, request.id, values, s.route.role));
      s.notify(
        `${rescheduling ? 'Inspeção reagendada' : 'Inspeção agendada'}. A data está disponível nos perfis envolvidos. Não foram enviadas notificações reais.`,
      );
    });
    back();
  }

  const unavailable = requestUnavailable(
    s.route.role,
    request,
    elevator,
    (status) => ['Por agendar', 'Agendado'].includes(status),
    s.go,
  );

  if (unavailable) return unavailable;

  return (
    <>
      <RequestBreadcrumb
        label={rescheduling ? 'Inspeções atribuídas' : 'Agendar inspeções'}
        onBack={back}
        elevatorId={elevator?.id}
      />
      <Heading
        title={rescheduling ? 'Reagendar inspeção' : title}
        description={`Processo n.º ${request?.id}`}
        status={request?.status}
        onBack={s.route.id ? () => s.back(parent) : undefined}
      />
      <FormShell
        form={form}
        title={title}
        onSubmit={submit}
        onCancel={back}
        submitLabel={rescheduling ? 'Confirmar reagendamento' : 'Confirmar agendamento'}
      >
        <RequestSummary
          request={request!}
          elevator={elevator!}
          extra={[
            ['Proprietário', elevator!.owner],
            ['Válido até', formatDate(elevator!.validUntil)],
          ]}
        />
        <Panel title="Data e hora">
          <div className="form-grid">
            {field('date', 'Data da inspeção', {
              type: 'date',
              min: localToday(),
              required: true,
            })}
            {field('time', 'Hora', { type: 'time', required: true })}
          </div>
        </Panel>
        <Panel title="Destinatários do agendamento">
          <ul className="check-list">
            <li>Câmara Municipal de Aveiro</li>
            <li>{elevator!.company} — manutenção</li>
            <li>{elevator!.owner} — proprietário</li>
          </ul>
          <p className="muted inset">Neste protótipo, a informação é atualizada apenas no ecrã.</p>
        </Panel>
      </FormShell>
    </>
  );
}
