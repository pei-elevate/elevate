import type { FormEvent } from 'react';
import { usePrototype } from '@/app/state';
import { certificateStatus } from '@/features/elevators/rules';
import {
  RequestBreadcrumb,
  RequestSummary,
  requestUnavailable,
  useInspectionRequest,
} from '@/features/inspections/inspectionRequest';
import { validateResult } from '@/features/inspections/validation';
import { FormShell } from '@/shared/forms/FormShell';
import { useSubmissionForm } from '@/shared/forms/useSubmissionForm';
import { formatDate, localToday } from '@/shared/lib/dates';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';

const title = 'Submeter resultado da inspeção';

export function InspectionResultForm() {
  const s = usePrototype();
  const { request, elevator } = useInspectionRequest();
  const form = useSubmissionForm({
    dirty: s.dirty,
    initial: { result: 'Aprovada', performed: localToday() },
  });
  const { values, file, field, upload } = form;
  const parent = 'atribuidas';
  const back = () => s.go(parent);

  function submit(event: FormEvent) {
    form.submit(
      event,
      () => validateResult(values, file),
      () => {
        void saveResult();
      },
    );
  }

  async function saveResult() {
    await form.save(() => {
      if (!request) return;
      s.setRequests((items) =>
        items.map((r) =>
          r.id === request.id
            ? {
                ...r,
                status: 'Concluído',
                result: values.result,
                performed: values.performed,
                report: file?.name,
                nonconformities: values.nonconformities,
              }
            : r,
        ),
      );

      if (file) s.setDocuments((d) => ({ ...d, [request.id]: file }));

      s.setElevators((items) =>
        items.map((e) =>
          e.id === request.elevator
            ? {
                ...e,
                status: certificateStatus(values.result, values.validUntil || ''),
                validUntil: values.result === 'Reprovada' ? '' : values.validUntil,
                entry: request.id,
                entryDate: request.date,
              }
            : e,
        ),
      );

      if (values.result === 'Reprovada') {
        s.setFailed((items) => [
          ...items.filter((f) => f.elevator !== request.elevator),
          {
            elevator: request.elevator,
            date: values.performed,
            deadline: values.deadline,
            resolved: false,
            requestId: request.id,
          },
        ]);
      }

      if (values.result === 'Aprovada')
        s.setFailed((items) => items.filter((f) => f.elevator !== request.elevator));

      s.notify('Resultado submetido. O relatório ficou disponível para consulta nesta sessão.');
    });
    back();
  }

  const unavailable = requestUnavailable(
    s.route.role,
    request,
    elevator,
    (status) => status === 'Agendado',
    s.go,
  );

  if (unavailable) return unavailable;

  return (
    <>
      <RequestBreadcrumb label="Inspeções atribuídas" onBack={back} elevatorId={elevator?.id} />
      <Heading
        title={title}
        description={`Processo n.º ${request?.id}`}
        status={request?.status}
        onBack={s.route.id ? () => s.back(parent) : undefined}
      />
      <FormShell
        form={form}
        title={title}
        onSubmit={submit}
        onCancel={back}
        submitLabel="Submeter resultado"
      >
        <RequestSummary
          request={request!}
          elevator={elevator!}
          extra={[
            [
              'Agendada para',
              `${formatDate(request!.scheduled)} · ${request!.scheduled.slice(11)}`,
            ],
          ]}
        />
        <Panel title="Resultado">
          <div className="form-grid">
            {field('result', 'Resultado da inspeção', {
              required: true,
              options: ['Aprovada', 'Reprovada'],
            })}
            {field('performed', 'Data de realização', {
              required: true,
              type: 'date',
              max: localToday(),
            })}
            {values.result === 'Aprovada'
              ? field('validUntil', 'Certificado válido até', {
                  required: true,
                  type: 'date',
                  min: values.performed || localToday(),
                })
              : field('deadline', 'Prazo de correção', {
                  required: true,
                  type: 'date',
                  min: values.performed || localToday(),
                })}
            {field('nonconformities', 'Não conformidades', {
              type: 'textarea',
              wide: true,
              required: values.result === 'Reprovada',
              hint: 'Obrigatório em caso de reprovação. Uma não conformidade por linha.',
            })}
          </div>
        </Panel>
        <Panel title="Relatório">
          <div className="form-grid">{upload(true)}</div>
        </Panel>
      </FormShell>
    </>
  );
}
