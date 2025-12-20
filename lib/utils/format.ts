import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'MMM dd, yyyy');
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'MMM dd, yyyy HH:mm');
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  
  if (isToday(dateObj)) {
    return `Today at ${format(dateObj, 'HH:mm')}`;
  }
  if (isYesterday(dateObj)) {
    return `Yesterday at ${format(dateObj, 'HH:mm')}`;
  }
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Safely converts error objects to string messages for display
 * Prevents React errors when trying to render error objects
 */
export function formatErrorMessage(error: any, defaultMessage: string = 'An error occurred'): string {
  if (!error) return defaultMessage;
  
  // If it's already a string, return it
  if (typeof error === 'string') return error;
  
  // If it's an array, format each item
  if (Array.isArray(error)) {
    return error
      .map((e: any) => {
        if (typeof e === 'string') return e;
        if (e?.message) return e.message;
        if (e?.path && e?.message) return `${e.path.join('.')}: ${e.message}`;
        return JSON.stringify(e);
      })
      .join(', ');
  }
  
  // If it's an object with an error property
  if (error?.error) {
    return formatErrorMessage(error.error, defaultMessage);
  }
  
  // If it has a message property
  if (error?.message) return error.message;
  
  // If it's a Zod error with issues
  if (error?.issues && Array.isArray(error.issues)) {
    return error.issues
      .map((issue: any) => {
        const path = issue.path?.join('.') || '';
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join(', ');
  }
  
  // Last resort: try to stringify
  try {
    const str = JSON.stringify(error);
    // If the stringified version is too long or not useful, return default
    if (str.length > 200 || str === '{}') return defaultMessage;
    return str;
  } catch {
    return defaultMessage;
  }
}

