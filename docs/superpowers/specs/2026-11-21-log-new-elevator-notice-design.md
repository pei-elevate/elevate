# ELEV-48 · Registar novo aviso de elevador (alvará do Urbanismo)

## Intenção

O Urbanismo da CMA regista os alvarás de utilização que incluem elevadores, com a morada, o número de elevadores e o proprietário. Cada alvará guardado funciona como o "alerta de registo pendente" da user story. A divisão de elevadores (o gestor municipal) usa-o para acompanhar o registo junto do proprietário e da empresa de manutenção. O requisito funcional pede que o gestor seja avisado automaticamente. Aqui, esse aviso é o alvará aparecer na lista "Elevadores não registados" e no contador do menu do gestor.

Hoje o formulário (`NewPermitForm`) e a lista (`PermitsPage`) só trabalham em memória, com mocks. Esta feature liga-os à API.

## Objetivos

- `POST /api/permits` para o perfil `urban_planning`.
- `GET /api/permits` com o estado e as contagens calculados no backend. Este endpoint serve:
  - a lista do Urbanismo ("Alvarás registados");
  - a lista do gestor ("Elevadores não registados") e o contador do menu dele;
  - o ecrã de validação de registos, que continua a usar só os campos de antes.

## Fora do âmbito

- Enviar emails ou alertas. O botão "Emitir alerta" continua simulado e fica para a story do alerta.
- Uma tabela ou um serviço de notificações.
- A sugestão de alvará no registo de elevador, que continua a usar os mocks.
- A empresa de manutenção no alvará: o campo sai do formulário e `maintenance_company_id` fica `NULL`.
- Mudanças no schema da BD e migrações.

## Anti-objetivos

- O gestor e o Urbanismo verem estados diferentes para o mesmo alvará.
- Um mesmo proprietário (o mesmo NIF) não poder ter vários alvarás.

## Abordagens consideradas

| Ponto | Escolhida | Alternativas rejeitadas |
|-------|-----------|-------------------------|
| Notificação ao gestor | O próprio alvará, visto na app | Email (não existe serviço de email); linha em `notices` (é para ofícios); tabela de notificações nova (trabalho a mais agora) |
| Onde se calcula o estado | No backend, uma só query com agregados | No frontend a partir das contagens (a regra ficaria no cliente) |
| Contrato do GET | Acrescentar campos ao `GET /api/permits` atual | Endpoint separado (dois endpoints quase iguais) |
| Página | `PermitsPage` única, os dois perfis leem da API | Separar em duas páginas; uma página com duas fontes de dados (API e mocks) |
| Validação | Repetida no backend com as mesmas regras | Freguesia limitada a uma lista no backend; validar só o que a BD exige |

## Regras

- **Quem pode**: só `urban_planning` cria alvarás. `urban_planning` e `municipal_manager` leem a lista.
- **Campos**:
  - n.º do alvará (único);
  - data do alvará (não pode ser futura);
  - morada, código postal (`3800-000`) e freguesia (texto não vazio);
  - n.º de elevadores (≥ 1);
  - nome do proprietário, NIF (9 algarismos), email (obrigatório; a mesma regex do registo de elevador) e telefone (opcional).
- **Proprietário**: se o NIF já existir, o alvará liga-se ao proprietário existente e o nome, o email e o telefone dele não mudam. Senão, cria-se um proprietário novo, com `type` a `NULL`.
- **N.º repetido**: responde 409 e não cria nada, nem sequer o proprietário. No formulário, o erro aparece no campo do n.º.
- **Contagens** (elevadores ligados ao alvará):
  - `registered`: os aprovados;
  - `pending`: os por validar;
  - `missing`: `max(num_elevators − registered − pending, 0)`. Os rejeitados contam como em falta.
- **Estado**:
  - `registered` ("Registado") se `registered ≥ num_elevators`;
  - `pending` ("Por validar") se `missing = 0` e `pending > 0`;
  - `missing` ("Por registar") em todos os outros casos.
  - O estado "Parcialmente registado" deixa de existir.
- **Último alerta**: `last_alert_at` é o `created_at` mais recente das notices `missing_registration` do alvará.

## Interface

- **Lista do Urbanismo**:
  - separadores "Todos / Por registar / Por validar / Registado";
  - colunas "Edifício / alvará", "Data do alvará", "Elevadores", "Proprietário" e "Estado";
  - a coluna "Elevadores" mostra o total e, por baixo, "X por registar · Y por validar · Z registados".
- **Lista do gestor**:
  - separadores "Todos / Por registar / Por validar", sem os alvarás registados;
  - as mesmas colunas, mais "Alerta" e "Ação";
  - "Alerta" mostra `last_alert_at`, ou a data do clique simulado se houver;
  - "Analisar" abre a validação do registo por validar ligado ao alvará.
- **Contador do menu do gestor** ("Elevadores não registados"): conta os alvarás com estado diferente de `registered`.
- **Formulário**:
  - sai "Empresa de manutenção" e entram "Correio eletrónico" (obrigatório) e "Telefone" (opcional);
  - ao guardar com sucesso, recarrega a lista, mostra a mensagem de confirmação e volta à lista.

## O que fica para quem implementa

- Os nomes internos de funções e tipos, e a organização dos testes.
- Detetar o n.º repetido: verificar antes de inserir, ou apanhar o `IntegrityError`. Em qualquer dos casos, não pode ficar um proprietário criado.
- Os textos das mensagens de erro de carregamento, seguindo o padrão do ecrã de validação.
