// Thrown from route handlers for expected failures; the error middleware
// turns it into `{ error: message }` with the given status.
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
