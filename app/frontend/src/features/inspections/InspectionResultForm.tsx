import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePrototype } from '@/app/state';
import { resultError, submitResult } from '@/features/inspections/api';
import {
  RequestBreadcrumb,
  RequestSummary,
  requestUnavailable,
  useAssignedRequest,
} from '@/features/inspections/inspectionRequest';
import { validateResult } from '@/features/inspections/validation';
import { FormShell } from '@/shared/forms/FormShell';
import { useSubmissionForm } from '@/shared/forms/useSubmissionForm';
import { formatDate, isISODate, localToday } from '@/shared/lib/dates';
import { Banner } from '@/shared/ui/Banner';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';

const title = 'Submeter resultado da inspeção';

// Resultado e relatório de um pedido agendado (ELEV-56). Corrigir um resultado já submetido
// fica para mais tarde: um pedido concluído não abre aqui.
export function InspectionResultForm() {
  const s = usePrototype();
  const { request, loading } = useAssignedRequest();
  const [saveError, setSaveError] = useState('');
  const form = useSubmissionForm({
    dirty: s.dirty,
    initial: { result: 'Aprovada', performed: localToday() },
  });
  const { values, file, field, upload } = form;
  // Enquanto a data de realização não está completa, a validade e o prazo contam de hoje.
  const performedOrToday = isISODate(values.performed) ? values.performed : localToday();
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
    if (request?.key === undefined || !file) return;
    const { key } = request;
    const report = file;

    setSaveError('');
    try {
      await form.save(async () => {
        await submitResult(s.route.role, key, values, report);
        s.reloadAssignedRequests();
        s.notify(
          'Resultado submetido. O relatório fica no histórico do elevador, para a Câmara, o proprietário e a empresa de manutenção.',
        );
      });
    } catch (error) {
      setSaveError(resultError(error));
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
    (status) => status === 'Agendado',
    s.go,
  );

  if (unavailable || !request) return unavailable;

  return (
    <>
      <RequestBreadcrumb label="Inspeções atribuídas" onBack={back} elevatorId={request.elevator} />
      <Heading
        title={title}
        description={`Processo n.º ${request.id}`}
        status={request.status}
        onBack={s.route.id ? () => s.back(parent) : undefined}
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
        submitLabel="Submeter resultado"
      >
        <RequestSummary
          request={request}
          extra={[
            ['Agendada para', `${formatDate(request.scheduled)} · ${request.scheduled.slice(11)}`],
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
                  min: performedOrToday,
                })
              : field('deadline', 'Prazo de correção', {
                  required: true,
                  type: 'date',
                  min: performedOrToday,
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
