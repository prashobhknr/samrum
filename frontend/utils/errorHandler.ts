/**
 * Error Handler Utility
 * Centralized error handling for API calls and form validation
 */

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(code);
    this.name = 'AppError';
  }
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Parse API error response
 */
export function parseApiError(error: any): { message: string; code: string; details?: any } {
  // Axios error
  if (error.response) {
    const { status, data } = error.response;
    return {
      code: data?.code || 'API_ERROR',
      message: data?.message || `API Error: ${status}`,
      details: data?.details,
    };
  }

  // Network error
  if (error.message === 'Network Error') {
    return {
      code: 'NETWORK_ERROR',
      message: 'Failed to connect to server. Please check your connection.',
    };
  }

  // Generic error
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'An unexpected error occurred',
  };
}

/**
 * Format validation errors
 */
export function formatValidationError(errors: ValidationError[]): string {
  if (errors.length === 0) return 'Validation failed';
  if (errors.length === 1) return errors[0].message;
  return `${errors.length} validation errors. ${errors[0].message}`;
}

/**
 * Create user-friendly error messages
 */
export function getUserMessage(error: any): string {
  const { code, message } = parseApiError(error);

  switch (code) {
    case 'UNAUTHORIZED':
      return 'Your session has expired. Please log in again.';
    case 'FORBIDDEN':
      return 'You do not have permission to perform this action.';
    case 'NOT_FOUND':
      return 'The requested resource was not found.';
    case 'VALIDATION_ERROR':
      return message;
    case 'NETWORK_ERROR':
      return message;
    case 'TIMEOUT':
      return 'Request timed out. Please try again.';
    default:
      return message || 'Something went wrong. Please try again.';
  }
}

/**
 * Retry strategy for failed requests
 */
export async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}

/**
 * Validate form fields
 */
export function validateFormFields(
  data: Record<string, any>,
  rules: Record<string, (value: any) => string | null>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [field, validator] of Object.entries(rules)) {
    const error = validator(data[field]);
    if (error) {
      errors.push({ field, message: error });
    }
  }

  return errors;
}

/**
 * Form field validators
 */
export const validators = {
  required: (value: any) => !value ? 'This field is required' : null,
  email: (value: string) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Invalid email address';
  },
  minLength: (length: number) => (value: string) => {
    return value && value.length >= length ? null : `Must be at least ${length} characters`;
  },
  maxLength: (length: number) => (value: string) => {
    return value && value.length <= length ? null : `Must be no more than ${length} characters`;
  },
  pattern: (pattern: RegExp, message: string) => (value: string) => {
    return value && pattern.test(value) ? null : message;
  },
};
