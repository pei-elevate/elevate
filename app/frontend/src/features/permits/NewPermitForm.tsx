import type { FormEvent } from 'react';
import { usePrototype } from '@/app/state';
import { validatePermit } from '@/features/permits/validation';
import { FormShell } from '@/shared/forms/FormShell';
import { OwnerAddressFields } from '@/shared/forms/OwnerAddressFields';
import { useSubmissionForm } from '@/shared/forms/useSubmissionForm';
import { localToday } from '@/shared/lib/dates';
import { Banner } from '@/shared/ui/Banner';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';

const title = 'Registar novo alvará';

export function NewPermitForm() {
  const s = usePrototype();
  const form = useSubmissionForm({
    dirty: s.dirty,
    initial: { count: '1', company: 'Elevar, Lda.' },
  });
  const { values, field } = form;
  const parent = 'avisos';
  const back = () => s.go(parent);

  function submit(event: FormEvent) {
    form.submit(
      event,
      () => {
        const next = validatePermit(values, form.file);

        if (s.urbanNotices.some((n) => n.permit === values.permit?.trim()))
          next.permit = 'Já existe um alvará registado com este número.';

        return next;
      },
      () => {
        void savePermit();
      },
    );
  }

  async function savePermit() {
    await form.save(() => {
      const id = crypto.randomUUID();
      s.setUrbanNotices((items) => [
        {
          id,
          address: values.address.trim(),
          permit: values.permit.trim(),
          date: values.permitDate,
          count: values.count,
          owner: values.owner.trim(),
          status: 'Não registado',
        },
        ...items,
      ]);
      s.notify('Alvará registado. Disponível para acompanhamento pelo gestor municipal.');
    });
    back();
  }

  return (
    <>
      <Heading
        title={title}
        description="Registar alvará de utilização de elevador proveniente de um plano de obras."
        onBack={s.route.id ? () => s.back(parent) : undefined}
      />
      <Banner>
        O alvará fica disponível para a divisão de elevadores acompanhar o registo junto do
        proprietário e da empresa de manutenção.
      </Banner>
      <FormShell
        form={form}
        title={title}
        onSubmit={submit}
        onCancel={back}
        submitLabel="Guardar alvará"
      >
        <Panel title="Alvará de utilização">
          <div className="form-grid">
            {field('permit', 'N.º do alvará', {
              required: true,
              placeholder: 'Ex.: 123/2026',
            })}
            {field('permitDate', 'Data do alvará', {
              type: 'date',
              required: true,
              max: localToday(),
            })}
          </div>
        </Panel>
        <OwnerAddressFields field={field} variant="permit" />
      </FormShell>
    </>
  );
}
