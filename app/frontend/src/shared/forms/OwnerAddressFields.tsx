import type { FieldRenderer } from '@/shared/forms/useSubmissionForm';
import { Panel } from '@/shared/ui/Panel';

const parishes = [
  'Glória e Vera Cruz',
  'Esgueira',
  'Aradas',
  'São Bernardo',
  'Cacia',
  'Eixo e Eirol',
  'Oliveirinha',
  'Requeixo, Nossa Senhora de Fátima e Nariz',
  'Santa Joana',
  'São Jacinto',
];

/** Localização e proprietário, comuns ao registo de elevador e ao registo de alvará. */
export function OwnerAddressFields({
  field,
  variant,
}: {
  field: FieldRenderer;
  variant: 'registration' | 'permit';
}) {
  const registration = variant === 'registration';

  return (
    <>
      <Panel title={registration ? 'Localização' : 'Edifício'}>
        <div className="form-grid">
          {field('address', 'Morada', {
            required: true,
            placeholder: 'Rua e número',
            wide: true,
          })}
          {field('postal', 'Código postal', { required: true, placeholder: '3800-000' })}
          {field('parish', 'Freguesia', { required: true, options: parishes })}
          {registration
            ? field('block', 'Edifício / bloco', { placeholder: 'Opcional' })
            : field('count', 'Número de elevadores', {
                type: 'number',
                min: '1',
                required: true,
              })}
        </div>
      </Panel>
      <Panel title={registration ? 'Proprietário' : 'Proprietário e manutenção'}>
        <div className="form-grid">
          {registration &&
            field('ownerType', 'Tipo de proprietário', {
              options: ['Condomínio', 'Pessoa singular', 'Pessoa coletiva'],
              required: true,
            })}
          {field(
            'owner',
            registration ? 'Nome do condomínio ou proprietário' : 'Proprietário / promotor',
            { required: true },
          )}
          {field('nif', 'NIF', { required: true, placeholder: '9 algarismos' })}
          {registration ? (
            <>
              {field('email', 'Correio eletrónico', {
                type: 'email',
                required: true,
                placeholder: 'nome@exemplo.pt',
              })}
              {field('phone', 'Telefone', { type: 'tel', placeholder: 'Opcional' })}
            </>
          ) : (
            field('company', 'Empresa de manutenção', { placeholder: 'Se conhecida' })
          )}
        </div>
      </Panel>
    </>
  );
}
