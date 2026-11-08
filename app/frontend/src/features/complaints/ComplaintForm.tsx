import type { FormEvent } from 'react';
import { usePrototype } from '@/app/state';
import { validateComplaint } from '@/features/complaints/validation';
import { FormShell } from '@/shared/forms/FormShell';
import { useSubmissionForm } from '@/shared/forms/useSubmissionForm';
import { localToday } from '@/shared/lib/dates';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';

const title = 'Registar reclamação';

export function ComplaintForm() {
  const s = usePrototype();
  const form = useSubmissionForm({
    dirty: s.dirty,
    initial: {
      status: 'Aberta',
      elevator: s.elevators.some((e) => e.id === s.route.id) ? s.route.id : '',
      received: localToday(),
    },
  });
  const { values, field } = form;
  const parent = 'reclamacoes';
  const back = () => s.go(parent);

  function submit(event: FormEvent) {
    form.submit(
      event,
      () => validateComplaint(values, form.file),
      () => {
        void saveComplaint();
      },
    );
  }

  async function saveComplaint() {
    await form.save(() => {
      const id = crypto.randomUUID();
      s.setComplaints((items) => [
        {
          id,
          elevator: values.elevator,
          received: values.received,
          description: values.description.trim(),
          status: values.status,
          responded: values.status === 'Resolvida' ? localToday() : undefined,
        },
        ...items,
      ]);
      s.notify('Reclamação registada.');
    });
    form.setValues((v) => ({ ...v, description: '', status: 'Aberta', received: localToday() }));
    form.setErrors({});
    back();
  }

  return (
    <>
      <div className="breadcrumb">
        <button onClick={back}>Reclamações</button>
        <span>/</span>
        <span>Nova reclamação</span>
      </div>
      <Heading
        title={title}
        description="Registar problemas comunicados pelos residentes."
        onBack={() => s.back(parent)}
      />
      <FormShell
        form={form}
        title={title}
        onSubmit={submit}
        onCancel={back}
        submitLabel="Registar reclamação"
      >
        <Panel title="Dados da reclamação">
          <div className="form-grid">
            {field('elevator', 'Elevador', {
              required: true,
              options: s.elevators
                .filter((e) => e.company === 'Elevar, Lda.')
                .map((e) => ({ value: e.id, label: `${e.id} — ${e.address}` })),
            })}
            {field('received', 'Data de receção', {
              type: 'date',
              required: true,
              max: localToday(),
            })}
            {field('description', 'Descrição do problema', {
              type: 'textarea',
              required: true,
              wide: true,
              placeholder: 'Descreva o problema comunicado.',
            })}
            {field('status', 'Estado', { options: ['Aberta', 'Resolvida'], required: true })}
          </div>
        </Panel>
      </FormShell>
    </>
  );
}
