/**
 * Privacy helpers for logs and operational traces.
 */
export function maskPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return 'unknown';

  const value = String(phoneNumber).trim();
  if (!value) return 'unknown';
  if (value.length <= 6) return `${value.slice(0, 2)}****`;

  return `${value.slice(0, 6)}****`;
}

