/**
 * HackHub UI Formatters and User-Friendly Error Helpers
 * Converts raw backend statuses and error codes into clear, plain-English guidance.
 */

export function getFriendlyErrorMessage(error, defaultMessage = 'An unexpected error occurred. Please try again.') {
  if (!error) return defaultMessage;
  
  const raw = typeof error === 'string' ? error : (error.message || defaultMessage);
  
  // Log detailed developer error to console without polluting the user UI
  console.warn('[HackHub Diagnostic Log]', error);

  const lower = raw.toLowerCase();

  if (lower.includes('403') || lower.includes('forbidden')) {
    return "You don't have permission to perform this action. Contact the event organizer if you believe this is a mistake.";
  }

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('jwt') || lower.includes('session expired')) {
    return 'Your session has expired. Please sign in again to continue.';
  }

  if (lower.includes('404') || lower.includes('notfound') || lower.includes('not found')) {
    return 'The requested resource was not found or may have been deleted.';
  }

  if (lower.includes('409') || lower.includes('conflict') || lower.includes('duplicatereview')) {
    return 'This action has already been performed or a record with these details already exists.';
  }

  if (lower.includes('closed') || lower.includes('ended')) {
    return 'Judging or submissions are closed for this event. No further changes can be accepted.';
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network error')) {
    return 'Unable to reach the HackHub server. Please check your network connection and retry.';
  }

  return raw;
}
