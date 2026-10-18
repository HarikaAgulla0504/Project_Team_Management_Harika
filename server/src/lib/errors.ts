// A single error type for "expected" failures. The central error handler turns
// it into a consistent JSON response: { error: { code, message, details? } }.
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = 'ERROR',
    public details?: unknown,
  ) {
    super(message);
  }
}

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, message, 'UNAUTHORIZED');
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, message, 'FORBIDDEN');
export const notFound = (message = 'Resource not found') => new AppError(404, message, 'NOT_FOUND');
