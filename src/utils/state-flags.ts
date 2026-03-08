/**
 * State Flags Utility
 * Centralizes flag management to eliminate inconsistent patterns across nodes.
 */

export type StateFlag =
  | 'handoff_requested'
  | 'visit_requested'
  | 'asked_name_once'
  | 'awaiting_name'
  | 'tradeInProcessed'
  | (string & {}); // Allow dynamic flags like `viewed_vehicle_${id}`

export function hasFlag(flags: string[] | undefined, flag: StateFlag): boolean {
  return (flags || []).includes(flag);
}

export function addFlag(flags: string[] | undefined, flag: StateFlag): string[] {
  const current = flags || [];
  return current.includes(flag) ? current : [...current, flag];
}

export function removeFlag(flags: string[] | undefined, flag: StateFlag): string[] {
  return (flags || []).filter(f => f !== flag);
}

/**
 * Conditionally adds a flag only when the condition is true.
 * Returns the original array unchanged when condition is false.
 */
export function addFlagIf(
  flags: string[] | undefined,
  flag: StateFlag,
  condition: boolean
): string[] {
  if (!condition) return flags || [];
  return addFlag(flags, flag);
}
