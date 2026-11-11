const apiErrorBrand = Symbol.for('along-a-parallel.ApiError');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.defineProperty(this, apiErrorBrand, { value: true });
  }
}

/** HMR can keep an older Store and error constructor alive in globalThis. */
export function isApiError(error: unknown): error is ApiError {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & { status?: unknown };
  return (
    typeof candidate.status === 'number' &&
    Number.isInteger(candidate.status) &&
    candidate.status >= 400 &&
    candidate.status <= 599 &&
    (Reflect.get(error, apiErrorBrand) === true || Object.hasOwn(error, 'status'))
  );
}
