export function isUnauthorizedError(error: any): boolean {
  // Check for ApiError with status property
  if (error && typeof error === 'object' && 'status' in error) {
    return error.status === 401;
  }
  
  // Fallback to message pattern matching for regular Error instances
  return /^401: .*Unauthorized/.test(error?.message || '');
}
