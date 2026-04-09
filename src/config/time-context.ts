/**
 * Time Context Module
 *
 * Detects the current time slot and maps it to an emotional selling mode.
 * Used to adapt conversation tone based on the time of day.
 */

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'late_night';

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
 * Check if current time is within quiet hours (22h-08h) — no follow-up messages.
 */
export function isQuietHours(date?: Date): boolean {
  const hour = (date || new Date()).getHours();
  return hour >= 22 || hour < 8;
}

/**
 * Get the next allowed send time (08:00) if currently in quiet hours.
 */
export function getNextSendTime(date?: Date): Date {
  const now = date || new Date();
  if (!isQuietHours(now)) return now;

  const next = new Date(now);
  if (now.getHours() >= 22) {
    next.setDate(next.getDate() + 1);
  }
  next.setHours(8, 0, 0, 0);
  return next;
}
