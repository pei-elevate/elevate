import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePrototype } from '@/app/state';
import { createPermit, permitError } from '@/features/permits/api';
import type { NewPermitBody } from '@/features/permits/api';
import { validatePermit } from '@/features/permits/validation';
import { FormShell } from '@/shared/forms/FormShell';
import { OwnerAddressFields } from '@/shared/forms/OwnerAddressFields';
import type { Values } from '@/shared/forms/types';
import { useSubmissionForm } from '@/shared/forms/useSubmissionForm';
import { localToday } from '@/shared/lib/dates';
import { Banner } from '@/shared/ui/Banner';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';

const title = 'Registar novo alvará';

/** Os valores do formulário no formato da API, sem espaços à volta; telefone vazio é null. */
export function toNewPermitBody(v: Values): NewPermitBody {
  const text = (key: string) => (v[key] ?? '').trim();

  return {
    permit_number: text('permit'),
    permit_date: text('permitDate'),
    address: text('address'),
    postal_code: text('postal'),
    parish: text('parish'),
    num_elevators: Number(text('count')),
    owner_name: text('owner'),
    owner_nif: text('nif'),
    owner_email: text('email'),
    owner_phone: text('phone') || null,
  };
}

export function NewPermitForm() {
  const s = usePrototype();
  const form = useSubmissionForm({
    dirty: s.dirty,
    initial: { count: '1' },
  });
  // Erro da API que não pertence a nenhum campo (ex.: servidor indisponível).
  const [saveError, setSaveError] = useState('');
  const { values, field } = form;
  const parent = 'avisos';
  const back = () => s.go(parent);

  function submit(event: FormEvent) {
    form.submit(
      event,
      () => {
        const next = validatePermit(values);

        if (s.permits?.some((p) => p.permit_number === values.permit?.trim()))
          next.permit = 'Já existe um alvará registado com este número.';

        return next;
      },
      () => {
        void savePermit();
      },
    );
  }

  async function savePermit() {
    setSaveError('');
    try {
      await form.save(async () => {
        await createPermit(s.route.role, toNewPermitBody(values));
        s.reloadPermits();
        s.notify('Alvará registado. Disponível para acompanhamento pelo gestor municipal.');
      });
    } catch (error) {
      const { field, message } = permitError(error);

      if (field) form.setErrors((errors) => ({ ...errors, [field]: message }));
      else setSaveError(message);

      return;
    }
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
