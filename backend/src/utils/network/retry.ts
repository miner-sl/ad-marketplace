export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T | undefined> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
  } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));

      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        console.error(`Failed after ${attempt} attempts:`, error);
        return undefined;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      console.warn(`Retry ${attempt}/${maxRetries} in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return undefined;
}
