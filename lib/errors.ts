/**
 * Carries an HTTP status so server routes can map failures to a response code.
 * Safe to import from browser code: it is a plain Error subclass, and the tools
 * that now run client-side simply surface `message`.
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
