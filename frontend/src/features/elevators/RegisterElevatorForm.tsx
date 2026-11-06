import type { FormEvent } from 'react';
import { usePrototype } from '@/app/state';
import { resubmitRegistration } from '@/features/elevators/rules';
import { validateRegistration } from '@/features/elevators/validation';
import { reconcileNotices } from '@/features/permits/rules';
import { FormShell } from '@/shared/forms/FormShell';
import { OwnerAddressFields } from '@/shared/forms/OwnerAddressFields';
import { useSubmissionForm } from '@/shared/forms/useSubmissionForm';
import { localToday } from '@/shared/lib/dates';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Panel } from '@/shared/ui/Panel';

const title = 'Registar elevador';

/** Registo de um elevador novo, ou correção de um registo rejeitado (`registar/<id>`). */
export function RegisterElevatorForm() {
  const s = usePrototype();
  const registration = s.registrations.find((r) => r.id === s.route.id);
  const form = useSubmissionForm({
    dirty: s.dirty,
    initial: {
      ownerType: 'Condomínio',
      ...(registration
        ? {
            address: registration.address,
            postal: registration.postal,
            parish: registration.parish,
            owner: registration.owner,
            nif: registration.nif,
            email: registration.email,
            service: registration.service,
            ownerType: registration.ownerType || 'Condomínio',
            dge: registration.dge || '',
            block: registration.block || '',
            phone: registration.phone || '',
          }
        : {}),
    },
    initialFile: registration ? s.documents[registration.id] || null : null,
    initialDocument: registration?.document || '',
  });
  const { values, file, keptDocument, field, upload } = form;
  const parent = 'elevadores';
  const back = () => s.go(parent);

  function submit(event: FormEvent) {
    form.submit(
      event,
      () => {
        const next = validateRegistration(values, file);

        if (values.dge?.trim() && s.elevators.some((e) => e.dge === values.dge.trim()))
          next.dge = 'Já existe um elevador com este número DGE.';

        return next;
      },
      () => {
        void saveRegistration();
      },
    );
  }

  async function saveRegistration() {
    await form.save(() => {
      const id = registration?.id || crypto.randomUUID();
      const changes = {
        address: values.address.trim(),
        postal: values.postal,
        parish: values.parish,
        owner: values.owner.trim(),
        nif: values.nif,
        email: values.email,
        service: values.service,
        dge: values.dge?.trim(),
        block: values.block?.trim(),
        phone: values.phone?.trim(),
        ownerType: values.ownerType,
      };
      const next = registration
        ? resubmitRegistration(s.registrations, registration.id, changes, s.route.role)
        : [
            ...s.registrations,
            {
              ...changes,
              id,
              company: 'Elevar, Lda.',
              status: 'Por validar',
              permit:
                s.urbanNotices.find((notice) => notice.address === changes.address)?.permit || '',
            },
          ];
      s.setRegistrations(next);
      s.setUrbanNotices((items) => reconcileNotices(items, next));
      s.setDocuments((documents) => {
        const nextDocuments = { ...documents };
        if (file) nextDocuments[id] = file;
        else if (!keptDocument) delete nextDocuments[id];
        return nextDocuments;
      });
      s.notify(
        registration
          ? 'Registo corrigido e novamente submetido para validação.'
          : 'Registo submetido. Aguarda validação municipal.',
      );
    });
    back();
  }

  if (
    s.route.id &&
    (!registration ||
      registration.status !== 'Rejeitado' ||
      registration.company !== 'Elevar, Lda.' ||
      s.route.role !== 'manutencao')
  ) {
    return (
      <>
        <Heading title="Registo indisponível para correção" />
        <Button onClick={() => s.go('elevadores')}>Voltar aos elevadores</Button>
      </>
    );
  }

  return (
    <>
      <Heading
        title={registration ? 'Corrigir registo' : title}
        description="Comunicar um novo elevador ao município."
        onBack={s.route.id ? () => s.back(parent) : undefined}
      />
      {registration?.reason && (
        <Banner tone="warning">
          <strong>Motivo da rejeição anterior:</strong> {registration.reason}
        </Banner>
      )}
      <Banner>
        Após a submissão, o município valida o registo e atribui uma referência interna ao
        elevador.
      </Banner>
      <FormShell
        form={form}
        title={title}
        onSubmit={submit}
        onCancel={back}
        submitLabel={registration ? 'Voltar a submeter' : 'Submeter registo'}
      >
        <OwnerAddressFields field={field} variant="registration" />
        <Panel title="Elevador">
          <div className="form-grid">
            {field('service', 'Entrada em serviço', {
              type: 'date',
              required: true,
              max: localToday(),
            })}
            {field('dge', 'Número DGE', { placeholder: 'Se já atribuído' })}
          </div>
        </Panel>
        <Panel title="Documentos de suporte">
          <div className="form-grid">{upload()}</div>
        </Panel>
      </FormShell>
    </>
  );
}
