# Registar novo aviso de elevador (ELEV-48) · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** o Urbanismo cria alvarás pela API. A lista do Urbanismo, a lista do gestor e o contador do menu do gestor leem `GET /api/permits`, que devolve o estado e as contagens calculados no backend.

**Arquitetura:**
- O módulo `api/permits/` segue o padrão de `api/elevators/` (router → service → repository → schemas).
- O estado é calculado em Python a partir das contagens de uma só query agregada.
- No frontend, a lista de alvarás fica no estado global (`state.tsx`), carregada da API como `pendingRegistrations`.

**Stack:** FastAPI, SQLAlchemy 2, Pydantic 2, Postgres (testcontainers); React 19, Vite, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-11-21-log-new-elevator-notice-design.md`

## Restrições globais

- Só `urban_planning` cria alvarás. `urban_planning` e `municipal_manager` leem.
- O n.º do alvará é único: um repetido dá **409** e não cria nada, nem o proprietário.
- A data do alvará não pode ser futura. Tem de haver pelo menos 1 elevador. O NIF segue `^\d{9}$` e o código postal `^\d{4}-\d{3}$`.
- O email usa a regex `^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$` (a mesma de `features/elevators/validation.ts`) e não se acrescenta nenhuma dependência.
- Os textos levam strip e não podem ficar vazios. O telefone é opcional: vazio passa a `None`.
- Se o NIF já existir, reutiliza-se o proprietário sem alterar o nome, o email nem o telefone dele.
- O valor de `status` na API é `"missing" | "pending" | "registered"`. Os rótulos são "Por registar", "Por validar" e "Registado". "Parcialmente registado" não existe.
- `missing = max(num_elevators − registered − pending, 0)`. Os rejeitados não contam em `registered` nem em `pending`.
- O schema da BD não muda e não há migrações.
- Os textos de UI e os comentários seguem o estilo do projeto: português de Portugal no frontend e inglês nos comentários do backend.

## Foco da revisão

1. **Mais elevadores aprovados do que `num_elevators`** (por exemplo, o gestor associou elevadores a mais): o estado é `registered` e `missing = 0`, nunca negativo. Testado na Tarefa 1.
2. **NIF existente com outro nome ou email no pedido**: liga-se ao proprietário existente e os dados dele não mudam. Testado na Tarefa 2.
3. **N.º repetido com um NIF novo**: o 409 não pode deixar um proprietário órfão criado. Testado na Tarefa 2.
4. **Espaços à volta dos campos** (`"  200/2026 "`): grava-se o texto sem os espaços, e o duplicado detecta-se sobre o valor sem espaços. Testado na Tarefa 2.
5. **A API falha ao carregar a lista**: a página mostra o erro e o botão "Tentar novamente", em vez de uma lista vazia. Isto aparece como "Sem resultados" e enganaria o utilizador. Testado na Tarefa 4.

---

### Tarefa 1: GET /api/permits com estado, contagens e último alerta

**Ficheiros:**
- Criar: `backend/api/permits/schemas.py`, `backend/api/permits/service.py`
- Modificar: `backend/api/permits/repository.py`, `backend/api/permits/router.py`, `backend/api/seed.py`
- Testes: `backend/tests/test_permits.py`

**Interfaces:**
- Produz:
  - `PermitStatus = Literal["missing", "pending", "registered"]` (em `schemas.py`).
  - `PermitOut(PermitSummary)`, com `postal_code: str`, `parish: str`, `owner_name: str`, `registered: int`, `pending: int`, `missing: int`, `status: PermitStatus`, `last_alert_at: datetime | None`.
  - `service.permit_counts(num_elevators: int, registered: int, pending: int) -> tuple[int, PermitStatus]`, que devolve `(missing, status)`.
  - `service.list_permits(db) -> list[PermitOut]`.
  - `repository.list_permits(db) -> list[Row]`. Cada linha tem `Permit`, `owner_name`, `registered`, `pending` e `last_alert_at`.

- [ ] **Passo 1: escrever os testes que falham** em `tests/test_permits.py`. Reaproveitar os helpers `add_user` e o padrão de `test_lists_the_permits_newest_first`, e acrescentar um helper `add_permit(db, number, num_elevators=1, ...)` e outro que crie elevadores ligados com um dado `registration_status` (ver `make_elevator` em `tests/test_registrations.py`).

```python
@pytest.mark.parametrize(("num", "registered", "pending", "expected"), [
    (2, 0, 0, (2, "missing")),
    (2, 1, 0, (1, "missing")),
    (2, 1, 1, (0, "pending")),
    (1, 0, 1, (0, "pending")),
    (2, 2, 0, (0, "registered")),
    (1, 3, 0, (0, "registered")),
])
def test_permit_counts(num, registered, pending, expected):
    assert permit_counts(num, registered, pending) == expected

def test_lists_counts_and_status_from_the_linked_elevators(client, db):
    # alvará de 3 elevadores: 1 aprovado, 1 por validar, 1 rejeitado
    ...
    [p] = client.get("/api/permits", headers=manager).json()
    assert (p["registered"], p["pending"], p["missing"], p["status"]) == (1, 1, 1, "missing")
    assert p["owner_name"] == "Condomínio Viseu 30"
    assert p["parish"] == "Glória e Vera Cruz" and p["postal_code"] == "3810-000"

def test_last_alert_is_the_newest_missing_registration_notice(client, db):
    # duas notices missing_registration (created_at 2026-09-28 e 2026-10-05) + uma inspection_due mais recente
    ...
    assert p["last_alert_at"].startswith("2026-10-05")

def test_a_permit_without_alerts_or_elevators(client, db):
    ...
    assert p["last_alert_at"] is None and p["status"] == "missing" and p["missing"] == 1
```

  O teste `test_lists_the_permits_newest_first`, que já existe, tem de continuar a passar sem mudanças, porque a ordem é a mesma.

- [ ] **Passo 2: correr os testes e confirmar que falham.** Comando: `cd backend && uv run pytest tests/test_permits.py -v`. Resultado esperado: FAIL (ImportError de `permit_counts` / KeyError `registered`).

- [ ] **Passo 3: implementar.**
  - `repository.list_permits`: um `select` sobre `Permit` com `join(Owner)`, `outerjoin(Elevator, Elevator.permit_id == Permit.id)` e `outerjoin(Notice, (Notice.permit_id == Permit.id) & (Notice.type == NoticeType.MISSING_REGISTRATION))`. Usar `func.count(distinct(Elevator.id)).filter(Elevator.registration_status == APPROVED)`, a contagem equivalente para `PENDING_APPROVAL` e `func.max(Notice.created_at)`. O `group_by(Permit.id, Owner.name)` e a ordem (`permit_date desc, id desc`) ficam iguais. O `distinct` evita contagens a dobrar por causa do join às notices.
  - `service.list_permits` junta tudo num `PermitOut` (com `model_validate` sobre um dict) usando `permit_counts`.
  - No router, o GET passa a usar `response_model=list[PermitOut]` e chama `service.list_permits`.

- [ ] **Passo 4: seed.** Em `api/seed.py`, depois dos alvarás, acrescentar uma `Notice(type=MISSING_REGISTRATION, permit_id=permits["097/2026"].id, sent_by=<id do gestor>, subject="Elevador sem registo", body="…", recipients="Condomínio Viseu 30 <email do proprietário>", created_at=datetime(2026, 9, 28, 10, 0))`. Os valores vêm do mock `alerted: '2026-09-28'`. O nome real da variável do gestor no seed tem de ser confirmado.

- [ ] **Passo 5: correr toda a suíte do backend.** Comando: `uv run pytest`. Resultado esperado: tudo PASS. `test_registrations.py` continua verde, porque o ecrã de validação só usa os campos de `PermitSummary`.

- [ ] **Passo 6: commit.** `feat: devolver o estado e as contagens dos alvarás na API`

### Tarefa 2: POST /api/permits

**Ficheiros:**
- Modificar: `backend/api/permits/schemas.py`, `service.py`, `repository.py`, `router.py`
- Testes: `backend/tests/test_permits.py`

**Interfaces:**
- Consome: `PermitOut` e `permit_counts` da Tarefa 1.
- Produz:
  - `NewPermit`, com `permit_number: str`, `permit_date: date`, `address: str`, `postal_code: str`, `parish: str`, `num_elevators: int (ge=1)`, `owner_name: str`, `owner_nif: str`, `owner_email: str`, `owner_phone: str | None = None`.
  - `service.create_permit(db, user: User, data: NewPermit) -> PermitOut`.
  - `service.PermitNumberTaken(Exception)`.
  - `POST /api/permits`, que responde 201 com `PermitOut`.

- [ ] **Passo 1: escrever os testes que falham.**

```python
URBAN = {"X-User-Id": "urban_planning"}
BODY = {"permit_number": "200/2026", "permit_date": "2026-11-02", "address": "Rua Nova 1",
        "postal_code": "3800-100", "parish": "Esgueira", "num_elevators": 2,
        "owner_name": "Condomínio Rua Nova", "owner_nif": "900000099",
        "owner_email": "rua.nova@ex.pt", "owner_phone": None}

def test_creates_a_permit_waiting_for_registration(client, db):
    r = client.post("/api/permits", headers=URBAN, json=BODY)
    assert r.status_code == 201
    body = r.json()
    assert (body["status"], body["missing"], body["registered"], body["pending"]) == ("missing", 2, 0, 0)
    assert body["owner_name"] == "Condomínio Rua Nova"
    permit = db.scalar(select(Permit).where(Permit.permit_number == "200/2026"))
    assert permit.created_by == <id do utilizador urban_planning> and permit.maintenance_company_id is None
    # e aparece no GET do gestor

def test_reuses_the_owner_with_the_same_nif_without_changing_it(client, db):
    # Owner(nif="900000099", name="Nome antigo", email="antigo@ex.pt") já existe
    client.post("/api/permits", headers=URBAN, json=BODY | {"owner_name": "Outro", "owner_email": "x@ex.pt"})
    assert db.scalar(select(func.count()).select_from(Owner).where(Owner.nif == "900000099")) == 1
    # owner.name == "Nome antigo", owner.email == "antigo@ex.pt"; o alvará aponta para ele

def test_a_repeated_number_is_a_conflict_and_creates_nothing(client, db):
    client.post("/api/permits", headers=URBAN, json=BODY)
    r = client.post("/api/permits", headers=URBAN, json=BODY | {"permit_number": " 200/2026 ", "owner_nif": "900000098"})
    assert r.status_code == 409
    assert db.scalar(select(Owner).where(Owner.nif == "900000098")) is None
    assert <número de alvarás 200/2026> == 1

def test_strips_whitespace(client, db):
    r = client.post("/api/permits", headers=URBAN, json=BODY | {"address": "  Rua Nova 1  ", "owner_phone": "  "})
    assert r.json()["address"] == "Rua Nova 1"
    # Owner.phone is None

@pytest.mark.parametrize("change", [
    {"owner_nif": "12345678"}, {"postal_code": "3800100"}, {"owner_email": "a@b"},
    {"permit_date": <amanhã ISO>}, {"num_elevators": 0}, {"address": "   "},
    {"permit_number": ""}, {"parish": ""}, {"owner_name": " "},
])
def test_invalid_data_is_rejected(client, db, change):
    assert client.post("/api/permits", headers=URBAN, json=BODY | change).status_code == 422

@pytest.mark.parametrize("role", [r for r in UserRole if r != UserRole.URBAN_PLANNING])
def test_only_urban_planning_creates(client, db, role): ...  # 403
def test_creating_requires_a_user(client): ...                # 401 sem cabeçalho
```

- [ ] **Passo 2: correr os testes e confirmar que falham.** Comando: `uv run pytest tests/test_permits.py -v`. Resultado esperado: os testes novos dão 405 ou falham.

- [ ] **Passo 3: implementar.**
  - **`NewPermit`**:
    - os campos de texto usam `Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]`;
    - o NIF, o código postal e o email usam `pattern=` com os valores das restrições globais;
    - a data passa por um `field_validator` que recusa `> date.today()`;
    - o telefone passa por um validator `mode="before"` que faz strip e transforma vazio em `None`.
  - **Repository**: `get_owner_by_nif(db, nif) -> Owner | None` e `permit_number_exists(db, number) -> bool`.
  - **`create_permit`**:
    - verifica `permit_number_exists` **antes** de criar o proprietário e, se existir, lança `PermitNumberTaken`;
    - reutiliza ou cria o `Owner(type=None, name, nif, email, phone)`;
    - cria o `Permit(created_by=user.id, maintenance_company_id=None, …)` e faz `commit`;
    - para o caso de corrida entre dois pedidos, envolve o `commit` num `except IntegrityError: db.rollback(); raise PermitNumberTaken`;
    - devolve um `PermitOut` com `registered=pending=0`, `(missing, status) = permit_counts(num, 0, 0)` e `last_alert_at=None`.
  - **Router**:
    - `UrbanPlanning = Annotated[User, Depends(require_role(UserRole.URBAN_PLANNING))]`;
    - `@router.post("", status_code=201, response_model=PermitOut)`;
    - um `http_errors()` traduz `PermitNumberTaken` em 409 com a mensagem `"A permit with this number already exists"`.

- [ ] **Passo 4: correr a suíte do backend.** Comando: `uv run pytest`. Resultado esperado: tudo PASS. Correr também `uv run ruff check . && uv run ruff format --check .` ou o equivalente que esteja em `pyproject.toml`.

- [ ] **Passo 5: commit.** `feat: registar alvarás pela API`

### Tarefa 3: cliente da API, regras e estado global no frontend

**Ficheiros:**
- Criar: `frontend/src/features/permits/api.ts`
- Modificar:
  - `frontend/src/features/elevators/api.ts`: retirar `listPermits` e `PermitSummary` e reexportá-los a partir de `permits/api`, ou atualizar os imports;
  - `frontend/src/features/elevators/ValidateRegistrationPage.tsx`: o import;
  - `frontend/src/features/permits/rules.ts`;
  - `frontend/src/app/state.tsx`;
  - `frontend/src/app/App.tsx`, no badge `nao-registados`.
- Testes: `frontend/tests/api.test.mjs`, `frontend/tests/rules.test.mjs`

**Interfaces:**
- Consome: o contrato JSON de `PermitOut` e `NewPermit` (Tarefas 1 e 2).
- Produz:
  - `PermitSummary` (movido, sem alterações).
  - `ApiPermit extends PermitSummary`, com `postal_code`, `parish`, `owner_name: string`, `registered`, `pending`, `missing: number`, `status: PermitStatus` e `last_alert_at: string | null`.
  - `type PermitStatus = 'missing' | 'pending' | 'registered'`.
  - `NewPermitBody`, com os mesmos nomes de `NewPermit`.
  - `listPermits(role: Role): Promise<ApiPermit[]>`.
  - `createPermit(role: Role, body: NewPermitBody): Promise<ApiPermit>`.
  - `permitError(error: unknown): { field?: 'permit'; message: string }`.
  - Em `rules.ts`: `permitStatusLabel(status: PermitStatus): string` e `elevatorCounts(p: Pick<ApiPermit,'missing'|'pending'|'registered'>): string`.
  - Em `state.tsx`: `permits: ApiPermit[] | null`, `permitsError: boolean`, `reloadPermits(): void`, `alerted: Record<number, string>` e `setAlerted`.

- [ ] **Passo 1: escrever os testes que falham.**

```js
test('createPermit envia o alvará do Urbanismo', async () => {
  const fetch = stubFetch(201, { id: 9, status: 'missing' });
  await createPermit('urbanismo', body);
  const [url, init] = fetch.mock.calls[0];
  assert.equal(url, '/api/permits');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['X-User-Id'], 'seed-urban-planning');
  assert.deepEqual(JSON.parse(init.body), body);
});
test('permitError: 409 aponta para o número do alvará', () => {
  assert.deepEqual(permitError(new ApiError(409, 'x')),
    { field: 'permit', message: 'Já existe um alvará registado com este número.' });
  assert.deepEqual(permitError(new ApiError(500, 'x')),
    { message: 'Não foi possível guardar o alvará. Tente novamente.' });
});
test('rótulos e contagens dos alvarás', () => {
  assert.equal(permitStatusLabel('missing'), 'Por registar');
  assert.equal(permitStatusLabel('pending'), 'Por validar');
  assert.equal(permitStatusLabel('registered'), 'Registado');
  assert.equal(elevatorCounts({ missing: 1, pending: 0, registered: 1 }), '1 por registar · 0 por validar · 1 registado');
  assert.equal(elevatorCounts({ missing: 0, pending: 1, registered: 0 }), '0 por registar · 1 por validar · 0 registados');
});
```

  O singular e o plural só se aplicam a "registado(s)", que é a única palavra que muda.

- [ ] **Passo 2: correr os testes e confirmar que falham.** Comando: `cd frontend && npm test`. Resultado esperado: FAIL nos imports.

- [ ] **Passo 3: implementar** `api.ts` e `rules.ts`. Em `state.tsx`, um `useEffect` igual ao de `pendingRegistrations`, mas que corre para `route.role` `urbanismo` ou `gestor` e tem como gatilhos `[route.role, route.page, permitsReloads]`; sai também `reloadPermits`. Em `App.tsx`, o badge passa a ser `'nao-registados': s.permits?.filter((p) => p.status !== 'registered').length ?? 0`. `urbanNotices` e `reconcileNotices` ficam, porque ainda são usados por `RegisterElevatorForm` e por `elevators/rules.ts`.

- [ ] **Passo 4: correr as verificações.** Comando: `npm run lint && npm run typecheck && npm test`. Resultado esperado: PASS.

- [ ] **Passo 5: commit.** `feat: carregar os alvarás da API no frontend`

### Tarefa 4: PermitsPage lê da API (Urbanismo e gestor)

**Ficheiros:**
- Modificar: `frontend/src/features/permits/PermitsPage.tsx`
- Testes: `frontend/tests/render.test.mjs` (renderização com `fetch` simulado)

**Interfaces:**
- Consome: `s.permits`, `s.permitsError`, `s.reloadPermits`, `s.alerted`/`setAlerted`, `s.pendingRegistrations`, `permitStatusLabel` e `elevatorCounts` (Tarefa 3).

- [ ] **Passo 1: escrever os testes que falham.** Seguir o estilo de `render.test.mjs`: renderizar `/avisos` como `urbanismo` e `/nao-registados` como `gestor`.
  - A página tem de continuar a mostrar o título enquanto carrega. As rotas que já existem não mudam.
  - Acrescentar um teste unitário de uma função pura exportada pela página, `visiblePermits(permits: ApiPermit[], tab: string, urban: boolean): ApiPermit[]`:
    - o gestor nunca vê `registered`;
    - o separador 'Por registar' filtra `missing`;
    - 'Todos' no Urbanismo inclui `registered`.
  - Teste do estado de erro: com `permitsError` a verdadeiro, a página mostra "Não foi possível carregar os alvarás." e um botão "Tentar novamente", sem o `Empty`. Se o `renderToString` com o provider não permitir controlar o estado, extrair `PermitsTableState({ permits, error, onRetry })` e testá-lo isoladamente.

- [ ] **Passo 2: correr os testes e confirmar que falham.** Comando: `npm test`. Resultado esperado: FAIL.

- [ ] **Passo 3: implementar.**
  - **Separadores**:
    - Urbanismo: `['Todos','Por registar','Por validar','Registado']`;
    - gestor: `['Todos','Por registar','Por validar']`.
  - **Cabeçalhos**: `'Edifício / alvará','Data do alvará','Elevadores','Proprietário','Estado'`, e no gestor mais `'Alerta','Ação'`.
  - **Célula "Elevadores"**: `<strong>{p.num_elevators}</strong><small>{elevatorCounts(p)}</small>`.
  - **"Alerta"**: `s.alerted[p.id] ?? p.last_alert_at` formatado com `formatDate` (só a parte da data), ou 'Não emitido'.
  - **"Analisar"** (quando `status === 'pending'`): `s.pendingRegistrations?.find((r) => r.permit?.id === p.id)?.id`.
  - **"Emitir alerta"**: o confirm e a mensagem ficam como estão e passam a gravar em `setAlerted`.
  - **Estados**: enquanto `permits === null` e não há erro, mostra "A carregar…", no padrão de `ValidateRegistrationPage`. Com erro, mostra a mensagem e o botão "Tentar novamente", que chama `s.reloadPermits()`.

- [ ] **Passo 4: correr as verificações.** Comando: `npm run lint && npm run typecheck && npm test`. Resultado esperado: PASS.

- [ ] **Passo 5: commit.** `feat: listar os alvarás a partir da API`

### Tarefa 5: o formulário "Registar novo alvará" grava na API

**Ficheiros:**
- Modificar:
  - `frontend/src/features/permits/NewPermitForm.tsx`;
  - `frontend/src/shared/forms/OwnerAddressFields.tsx` (variante `permit`);
  - `frontend/src/features/permits/validation.ts`;
  - possivelmente `frontend/src/shared/forms/validation.ts`, se o email passar a ser uma função partilhada.
- Testes: `frontend/tests/registration.test.mjs` (onde estão os testes de validação) ou um ficheiro novo `tests/permit.test.mjs`.

**Interfaces:**
- Consome: `createPermit`, `permitError`, `NewPermitBody` e `s.permits`/`s.reloadPermits` (Tarefa 3).
- Produz: `toNewPermitBody(v: Values): NewPermitBody`, que é pura e faz trim de tudo; o telefone vazio passa a `null` e `count` passa a `Number(count)`.

- [ ] **Passo 1: escrever os testes que falham.**

```js
test('validatePermit pede o email e já não pede anexo', () => {
  const e = validatePermit({ ...valid, email: '' }, null, '2026-11-21');
  assert.equal(e.email, 'Indique um endereço de correio eletrónico válido.');
  assert.deepEqual(validatePermit(valid, null, '2026-11-21'), {});
});
test('toNewPermitBody faz trim e converte os tipos', () => {
  assert.deepEqual(toNewPermitBody({ permit: ' 200/2026 ', permitDate: '2026-11-02', address: ' Rua Nova 1 ',
    postal: '3800-100', parish: 'Esgueira', count: '2', owner: 'Cond.', nif: '900000099',
    email: 'a@ex.pt', phone: ' ' }),
    { permit_number: '200/2026', permit_date: '2026-11-02', address: 'Rua Nova 1', postal_code: '3800-100',
      parish: 'Esgueira', num_elevators: 2, owner_name: 'Cond.', owner_nif: '900000099',
      owner_email: 'a@ex.pt', owner_phone: null });
});
```

- [ ] **Passo 2: correr os testes e confirmar que falham.** Comando: `npm test`. Resultado esperado: FAIL.

- [ ] **Passo 3: implementar.**
  - **`OwnerAddressFields`, variante `permit`**: em vez de `company`, os campos `email` ('Correio eletrónico', obrigatório, `type: 'email'`, placeholder 'nome@exemplo.pt') e `phone` ('Telefone', opcional), os mesmos da variante `registration`. O título do painel passa a ser 'Proprietário'.
  - **`validatePermit`**: sai `validateDocument` e entra a regra do email, com a mesma regex e a mesma mensagem do registo de elevador. Se fizer sentido, extrair `validateEmail(v, errors)` para `shared/forms/validation.ts` e usá-la nos dois sítios.
  - **`NewPermitForm`**:
    - o valor inicial passa a ser `{ count: '1' }`;
    - a verificação local de duplicados usa `s.permits?.some((p) => p.permit_number === values.permit.trim())`;
    - ao gravar, chama `form.save(async () => { await createPermit(role, toNewPermitBody(values)); s.reloadPermits(); s.notify('Alvará registado. Disponível para acompanhamento pelo gestor municipal.'); })` e volta para `avisos`;
    - num erro, `permitError` põe a mensagem no campo `permit` (se houver `field`) ou no alerta do formulário, e o formulário não sai da página;
    - confirmar em `useSubmissionForm` como se expõem `setErrors` e o `save` assíncrono e reutilizar isso; acrescentar só o que faltar.

- [ ] **Passo 4: correr as verificações.** Comando: `npm run lint && npm run typecheck && npm test`. Resultado esperado: PASS.

- [ ] **Passo 5: commit.** `feat: registar o alvará do Urbanismo na API`

### Tarefa 6: verificação de ponta a ponta

- [ ] **Passo 1:** correr `cd backend && uv run pytest` e `cd frontend && npm run lint && npm run typecheck && npm test`. Resultado esperado: tudo PASS.
- [ ] **Passo 2:** arrancar a stack (Docker Compose + seed, como no README) e confirmar no browser:
  - como `urbanismo`, registar "200/2026" com 2 elevadores. Aparece "Por registar" e "2 por registar · 0 por validar · 0 registados";
  - repetir "200/2026" dá o erro no campo;
  - como `gestor`, o alvará aparece em "Elevadores não registados" e o badge do menu sobe 1;
  - o 097/2026 mostra "Emitido em 28/09/2026";
  - "Validar registo" continua a listar os alvarás.
- [ ] **Passo 3:** corrigir o que falhar, com um commit por correção.
