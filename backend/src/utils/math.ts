/**
 * Generate a random integer between min (inclusive) and max (inclusive)
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns Random integer between min and max
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
