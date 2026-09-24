// Sèvizi — one place for "this failed but the screen should keep going"
// errors. Screens and API helpers used to swallow these with an empty
// `.catch(() => {})` / `if (error) return []`, which is how a broken
// PostgREST embed made the admin requests list look empty for weeks with
// nothing anywhere saying why. UX is unchanged (the caller still falls back
// to its empty state); the failure just becomes visible in Sentry and in the
// dev console.
import * as Sentry from '@sentry/react-native';

export function reportError(error: unknown, context?: string): void {
  if (__DEV__) console.warn(`[sevizi]${context ? ` ${context}:` : ''}`, error);
  try {
    Sentry.captureException(error instanceof Error ? error : new Error(
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error),
    ), context ? { tags: { context } } : undefined);
  } catch {
    // Reporting must never be the thing that breaks the app.
  }
}
