export class HttpError extends Error {
  constructor(status, expose) {
    super(expose);
    this.status = status;
    this.expose = expose;
  }
}
