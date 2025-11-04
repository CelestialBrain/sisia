export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateTermCode(termCode: string): ValidationResult {
  if (!termCode) {
    return { valid: true }; // Optional parameter
  }
  
  // Format: YYYYT where T is 1, 2, or 3
  const termPattern = /^\d{4}[123]$/;
  if (!termPattern.test(termCode)) {
    return {
      valid: false,
      error: 'Term code must be in format YYYYT (e.g., 20253)',
    };
  }
  
  return { valid: true };
}

export function validateLimit(limit: string | undefined, max = 100): ValidationResult {
  if (!limit) {
    return { valid: true };
  }
  
  const num = parseInt(limit, 10);
  if (isNaN(num) || num < 1 || num > max) {
    return {
      valid: false,
      error: `Limit must be between 1 and ${max}`,
    };
  }
  
  return { valid: true };
}

export function validateOffset(offset: string | undefined): ValidationResult {
  if (!offset) {
    return { valid: true };
  }
  
  const num = parseInt(offset, 10);
  if (isNaN(num) || num < 0) {
    return {
      valid: false,
      error: 'Offset must be a non-negative integer',
    };
  }
  
  return { valid: true };
}

export function validateDays(days: string | undefined): ValidationResult {
  if (!days) {
    return { valid: true };
  }
  
  const dayArray = days.split(',').map(d => parseInt(d.trim(), 10));
  const validDays = dayArray.every(d => d >= 0 && d <= 6);
  
  if (!validDays) {
    return {
      valid: false,
      error: 'Days must be comma-separated integers from 0 (Sunday) to 6 (Saturday)',
    };
  }
  
  return { valid: true };
}

export function validateUUID(id: string | undefined, fieldName = 'id'): ValidationResult {
  if (!id) {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }
  
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid UUID`,
    };
  }
  
  return { valid: true };
}
