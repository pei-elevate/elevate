import type { ApiElevator } from '@/features/elevators/api';
import { equipmentLabels, ownerTypeLabels } from '@/features/elevators/api';
import { results } from '@/features/inspections/api';
import { formatDate } from '@/shared/lib/dates';
import { Summary } from '@/shared/ui/Summary';

// Janela «Ver todos os dados» da ficha do elevador. Os campos vazios aparecem como «—»
// (o Summary trata disso). O alvará só vem da API para o gestor.
export function elevatorDataModal(a: ApiElevator) {
  const sections: [string, [string, string][]][] = [
    [
      'Elevador',
      [
        ['Tipo de equipamento', equipmentLabels[a.equipment_type]],
        ['N.º DGE', a.dge_number ?? ''],
        ['Morada', a.address],
        ['Edifício / bloco', a.building ?? ''],
        ['Código postal', a.postal_code],
        ['Freguesia', a.parish],
        ['Entrada em serviço', formatDate(a.service_date)],
      ],
    ],
    [
      'Proprietário',
      [
        ['Nome', a.owner.name],
        ['Tipo', a.owner.type ? ownerTypeLabels[a.owner.type] : ''],
        ['NIF', a.owner.nif],
        ['Email', a.owner.email],
        ['Telefone', a.owner.phone ?? ''],
      ],
    ],
    [
      'Manutenção',
      [
        ['Nome', a.maintenance_company.name],
        ['Email', a.maintenance_company.email ?? ''],
        ['Telefone', a.maintenance_company.phone ?? ''],
      ],
    ],
    [
      'Inspeção',
      [
        ['Empresa', a.inspection_company?.name ?? 'Por atribuir'],
        ['Última inspeção', formatDate(a.last_inspection?.performed_date ?? '')],
        ['Resultado', a.last_inspection ? results[a.last_inspection.result] : ''],
        ['Válido até', formatDate(a.valid_until ?? '')],
      ],
    ],
    [
      'Registo',
      [
        ['Data de registo', formatDate(a.created_at ?? '')],
        ...(a.permit
          ? ([['Alvará', `${a.permit.permit_number} · ${formatDate(a.permit.permit_date)}`]] as [
              string,
              string,
            ][])
          : []),
      ],
    ],
  ];

  return {
    title: `Dados do elevador ${a.internal_reference}`,
    body: (
      <>
        {sections.map(([title, items]) => (
          <section key={title}>
            <h3>{title}</h3>
            <Summary items={items} />
          </section>
        ))}
      </>
    ),
  };
}
