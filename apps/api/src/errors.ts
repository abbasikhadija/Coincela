import type { ErrorRequestHandler } from 'express';
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const malformed = error instanceof SyntaxError && 'status' in error && error.status === 400;
  const oversized = typeof error === 'object' && error !== null && 'status' in error && error.status === 413;
  const status = malformed ? 400 : oversized ? 413 : 500;
  res.status(status).json({ error: { code: status === 400 ? 'INVALID_JSON' : status === 413 ? 'BODY_TOO_LARGE' : 'INTERNAL_ERROR',
    message: malformed ? 'The request could not be read. Send valid JSON.' : oversized ? 'The request is too large.' : 'Something went wrong. Please try again.' } });
};
