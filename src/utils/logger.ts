// Centralized error logging utilities

export function logEmailError(
  context: string,
  requestId: string | undefined,
  userId: string | undefined,
  email: string | undefined,
  error: unknown
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(
    `[EMAIL_ERROR] ${context} | Request: ${requestId || 'N/A'} | User: ${userId || 'N/A'} | Email: ${email || 'N/A'}`,
    {
      message: errorMessage,
      ...(errorStack && { stack: errorStack }),
    }
  );
}

export function logMessageActionError(
  action: string,
  requestId: string | undefined,
  userId: string | undefined,
  error: unknown
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(
    `[MESSAGE_ERROR] ${action} | Request: ${requestId || 'N/A'} | User: ${userId || 'N/A'}`,
    {
      message: errorMessage,
      ...(errorStack && { stack: errorStack }),
    }
  );
}
