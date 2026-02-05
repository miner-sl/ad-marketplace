/**
 * Compare a target date with the current date (or provided reference date)
 * Returns information about whether the date has passed and remaining time
 */
export interface DateCompareResult {
  hasPassed: boolean;
  remainingMs: number;
  remainingHours: number;
  remainingDays: number;
}

/**
 * Compare a target date with current date (or provided reference date)
 * @param targetDate - The date to compare (can be Date object or date string)
 * @param referenceDate - Optional reference date (defaults to current date)
 * @returns DateCompareResult with comparison information
 */
export function compareDate(
  targetDate: Date | string,
  referenceDate?: Date
): DateCompareResult {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const reference = referenceDate || new Date();

  const remainingMs = target.getTime() - reference.getTime();
  const hasPassed = remainingMs <= 0;
  const remainingHours = Math.ceil(Math.abs(remainingMs) / (1000 * 60 * 60));
  const remainingDays = Math.ceil(Math.abs(remainingMs) / (1000 * 60 * 60 * 24));

  return {
    hasPassed,
    remainingMs: Math.abs(remainingMs),
    remainingHours,
    remainingDays,
  };
}
