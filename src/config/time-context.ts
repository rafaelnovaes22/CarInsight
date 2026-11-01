/**
 * Time Context Module
 *
 * Detects the current time slot and maps it to an emotional selling mode.
 * Used to adapt conversation tone based on the time of day.
 *
 * All follow-up quiet-hour checks use America/Sao_Paulo timezone so that
 * the scheduler works correctly regardless of the server's system timezone
 * (e.g., Railway runs in UTC).
 */

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'late_night';

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

/**
 * Extract hour (0-23) in Brazil timezone from a Date object.
 * Uses Intl.DateTimeFormat so it works correctly even when the server
 * is running in UTC (as on Railway).
 */
function getBrazilHour(date: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: BRAZIL_TIMEZONE,
  }).format(date);
  const n = parseInt(formatted, 10);
  return n === 24 ? 0 : n; // some Intl impls return "24" for midnight
}

export type EmotionalMode = 'rational' | 'balanced' | 'aspirational' | 'emotional';

const TIME_SLOT_CONFIG: Record<
  TimeSlot,
  { startHour: number; endHour: number; mode: EmotionalMode }
> = {
  morning: { startHour: 6, endHour: 11, mode: 'rational' },
  afternoon: { startHour: 12, endHour: 17, mode: 'balanced' },
  evening: { startHour: 18, endHour: 23, mode: 'aspirational' },
  late_night: { startHour: 0, endHour: 5, mode: 'emotional' },
};

/**
 * Get the current time slot based on hour of day.
 * Optionally accepts a Date for testing.
 */
export function getTimeSlot(date?: Date): TimeSlot {
  const hour = (date || new Date()).getHours();

  if (hour >= 6 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'afternoon';
  if (hour >= 18 && hour <= 23) return 'evening';
  return 'late_night'; // 0-5
}

/**
 * Get the emotional mode for the current time slot.
 */
export function getEmotionalMode(date?: Date): EmotionalMode {
  const slot = getTimeSlot(date);
  return TIME_SLOT_CONFIG[slot].mode;
}

/**
 * Check if it's late night (00h-05h) — peak emotional selling window.
 */
export function isLateNight(date?: Date): boolean {
  return getTimeSlot(date) === 'late_night';
}

/**
 * Check if current time is within quiet hours (22h-09h Brazil time) — no follow-up messages.
 * Uses America/Sao_Paulo timezone regardless of server timezone.
 */
export function isQuietHours(date?: Date): boolean {
  const hour = getBrazilHour(date || new Date());
  return hour >= 22 || hour < 9;
}

/**
 * Get the next allowed send time (09:00 Brazil time) if currently in quiet hours.
 * Returns a Date whose UTC value corresponds to 09:00 AM America/Sao_Paulo.
 */
export function getNextSendTime(date?: Date): Date {
  const now = date || new Date();
  if (!isQuietHours(now)) return now;

  const brazilHour = getBrazilHour(now);

  // Get the current date in Brazil timezone (en-CA gives ISO YYYY-MM-DD format)
  const brazilDateStr = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: BRAZIL_TIMEZONE,
  }).format(now);
  let [year, month, day] = brazilDateStr.split('-').map(Number);

  // If already past 22h in Brazil, target is next calendar day in Brazil
  if (brazilHour >= 22) {
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
    year = tomorrow.getUTCFullYear();
    month = tomorrow.getUTCMonth() + 1;
    day = tomorrow.getUTCDate();
  }

  // Determine UTC equivalent of 09:00 BRT on the target date.
  // Use noon UTC as a reference to compute the Brazil offset for that day.
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const brazilHourAtNoon = getBrazilHour(noonUTC); // 9 (UTC-3) or 10 (UTC-2 in summer)
  const utcOffsetHours = 12 - brazilHourAtNoon; // e.g. 3 for UTC-3
  const targetUTCHour = 9 + utcOffsetHours; // e.g. 12 for UTC-3

  return new Date(Date.UTC(year, month - 1, day, targetUTCHour, 0, 0, 0));
}
