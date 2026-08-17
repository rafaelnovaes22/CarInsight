/**
 * Privacy helpers for logs and operational traces.
 *
 * Governanca: LGPD e ISO/IEC 42001 Anexo A.7. Ver governance/data/data-lifecycle.md.
 * Ate 2026-07-29 apenas telefone era mascarado, e preservando 6 digitos (DDI + DDD + 2),
 * o que ainda identificava regiao e parte do numero. GAP-001 do risk-register (RSK-003).
 */

/** Preserva DDI + DDD (4 digitos) para permitir triagem operacional, mascara o resto. */
export function maskPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return 'unknown';

  const value = String(phoneNumber).trim();
  if (!value) return 'unknown';
  if (value.length <= 4) return '****';

  return `${value.slice(0, 4)}****`;
}

/** Preserva a primeira letra e o dominio, que e o que serve para depurar entrega. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return 'unknown';

  const value = String(email).trim();
  const at = value.lastIndexOf('@');
  if (at < 1) return '****';

  return `${value[0]}***@${value.slice(at + 1)}`;
}

/** Preserva o primeiro nome, mascara os sobrenomes: identifica menos a pessoa. */
export function maskName(name: string | null | undefined): string {
  if (!name) return 'unknown';

  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'unknown';
  if (parts.length === 1) return parts[0];

  return `${parts[0]} ${parts
    .slice(1)
    .map(() => '***')
    .join(' ')}`;
}

/** Campos que nunca devem sair em claro em log estruturado. */
const SENSITIVE_FIELDS: Record<string, (value: unknown) => string> = {
  phone: v => maskPhoneNumber(v as string),
  phoneNumber: v => maskPhoneNumber(v as string),
  email: v => maskEmail(v as string),
  name: v => maskName(v as string),
};

/**
 * Mascara campos sensiveis de um objeto de log, recursivamente.
 * Usar sempre que um objeto vindo do banco for para o logger.
 */
export function maskSensitiveFields<T>(payload: T): T {
  if (payload === null || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map(item => maskSensitiveFields(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const masker = SENSITIVE_FIELDS[key];
    if (masker && (typeof value === 'string' || value === null || value === undefined)) {
      result[key] = masker(value);
      continue;
    }
    result[key] = typeof value === 'object' ? maskSensitiveFields(value) : value;
  }

  return result as T;
}
