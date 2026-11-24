import type { Role } from '@/shared/auth/roles';

/**
 * Utilizador de cada perfil nos dados de exemplo do backend (`api/seed.py`). Até haver
 * Authentik, o backend identifica quem pede pelo cabeçalho `X-User-Id`.
 */
const seedUsers: Record<Role, string> = {
  proprietario: 'seed-owner',
  manutencao: 'seed-maintenance',
  urbanismo: 'seed-urban-planning',
  gestor: 'seed-municipal-manager',
  inspecao: 'seed-inspection',
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown };

/**
 * Pedido ao backend (`/api…`) em nome do perfil. Respostas fora de 2xx lançam `ApiError`.
 * Um corpo `FormData` (com ficheiros) segue tal como está, e o browser põe o Content-Type
 * multipart; qualquer outro vai em JSON.
 */
export async function api<T>(path: string, role: Role, options: Options = {}): Promise<T> {
  const response = await send(path, role, options);

  return response.json() as Promise<T>;
}

/** Ficheiro devolvido pelo backend (um PDF, por exemplo) e o nome com que o guardar. */
export async function apiFile(path: string, role: Role): Promise<{ blob: Blob; name: string }> {
  const response = await send(path, role);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'documento.pdf';

  return { blob: await response.blob(), name };
}

async function send(path: string, role: Role, { method = 'GET', body }: Options = {}) {
  const form = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      'X-User-Id': seedUsers[role],
      ...(body === undefined || form ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((b) => (typeof b?.detail === 'string' ? b.detail : ''))
      .catch(() => '');

    throw new ApiError(response.status, detail || response.statusText);
  }

  return response;
}
