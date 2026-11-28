import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePrototype } from '@/app/state';
import { scheduleError, scheduleRequest } from '@/features/inspections/api';
import {
  RequestBreadcrumb,
  RequestSummary,
  requestUnavailable,
  useAssignedRequest,
} from '@/features/inspections/inspectionRequest';
import { validateSchedule } from '@/features/inspections/validation';
import { FormShell } from '@/shared/forms/FormShell';
import { useSubmissionForm } from '@/shared/forms/useSubmissionForm';
import { localToday } from '@/shared/lib/dates';
import { Banner } from '@/shared/ui/Banner';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';

const title = 'Agendar inspeção';

// Agendar um pedido por agendar (ELEV-52). O reagendamento fica para mais tarde: um pedido
// já agendado não abre aqui.
export function ScheduleInspectionForm() {
  const s = usePrototype();
  const { request, loading } = useAssignedRequest();
  const [saveError, setSaveError] = useState('');
  const form = useSubmissionForm({ dirty: s.dirty, initial: { time: '09:00' } });
  const { values, field } = form;
  const back = () => s.go('agendar');

  function submit(event: FormEvent) {
    form.submit(
      event,
      () => validateSchedule(values, form.file),
      () => {
        void saveSchedule();
      },
    );
  }

  async function saveSchedule() {
    if (request?.key === undefined) return;
    const key = request.key;

    setSaveError('');
    try {
      await form.save(async () => {
        await scheduleRequest(s.route.role, key, `${values.date}T${values.time}`);
        s.reloadAssignedRequests();
        s.notify(
          'Inspeção agendada. A data fica visível para a Câmara, a empresa de manutenção e o proprietário.',
        );
      });
    } catch (error) {
      setSaveError(scheduleError(error));
      return;
    }
    back();
  }

  if (s.route.role === 'inspecao' && loading)
    return (
      <>
        <Heading title={title} />
        <p role="status">A carregar pedido…</p>
      </>
    );

  const unavailable = requestUnavailable(
    s.route.role,
    request,
    (status) => status === 'Por agendar',
    s.go,
  );

  if (unavailable || !request) return unavailable;

  return (
    <>
      <RequestBreadcrumb label="Agendar inspeções" onBack={back} elevatorId={request.elevator} />
      <Heading
        title={title}
        description={`Processo n.º ${request.id}`}
        status={request.status}
        onBack={s.route.id ? () => s.back('agendar') : undefined}
      />
      {saveError && (
        <div role="alert">
          <Banner tone="warning">{saveError}</Banner>
        </div>
      )}
      <FormShell
        form={form}
        title={title}
        onSubmit={submit}
        onCancel={back}
        submitLabel="Confirmar agendamento"
      >
        <RequestSummary request={request} />
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
            <li>{request.company} — manutenção</li>
            <li>Proprietário do elevador</li>
          </ul>
          <p className="muted inset">
            A data fica visível nos perfis destes destinatários. Não são enviados emails.
          </p>
        </Panel>
      </FormShell>
    </>
  );
}
