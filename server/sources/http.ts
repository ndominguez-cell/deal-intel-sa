const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

class ProviderResponseError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

function redact(value: string, secret: string): string {
  return secret ? value.split(secret).join("[redacted]") : value;
}

async function wait(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function fetchJsonWithRetry(
  url: URL,
  init: RequestInit,
  provider: string,
  secret: string,
  attempts = 3,
): Promise<unknown> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(20_000),
      });

      if (response.ok) return await response.json();

      const responseBody = redact((await response.text()).slice(0, 500), secret);
      const error = new ProviderResponseError(
        `${provider} request failed (${response.status}): ${responseBody || response.statusText}`,
        RETRYABLE_STATUSES.has(response.status),
      );
      if (!error.retryable || attempt === attempts - 1) {
        throw error;
      }
      lastError = error;
    } catch (error) {
      if (error instanceof ProviderResponseError && !error.retryable) throw error;
      lastError =
        error instanceof Error
          ? new Error(redact(error.message, secret))
          : new Error(redact(String(error), secret));
      if (attempt === attempts - 1) throw lastError;
    }

    await wait(Math.min(400 * 2 ** attempt, 2_000));
  }

  throw lastError ?? new Error(`${provider} request failed`);
}
