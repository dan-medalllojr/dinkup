export class ApiError extends Error {
  readonly status: number;
  readonly fields: Record<string, string[] | undefined>;

  constructor(status: number, message: string, fields: Record<string, string[] | undefined> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const REQUEST_TIMEOUT_MS = 15_000;

// Always JSON, always same-origin cookies. The server rejects non-JSON
// writes, so the Content-Type header is sent even when there's no body.
export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Without a timeout a stuck server leaves the UI on "Loading…" forever.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError(0, 'Dinkup is taking too long to respond. Try again in a moment.');
    }
    throw new ApiError(0, "Can't reach Dinkup. Check your connection.");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong', data.fields);
  return data as T;
}
