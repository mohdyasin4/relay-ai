/**
 * Utility function to generate a UUID with fallback for environments
 * where crypto.randomUUID is not available
 */
export function generateUUID(): string {
  // Check if crypto.randomUUID is available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback implementation for browsers without crypto.randomUUID
  // This is a simplified version of UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Utility function to generate a short UUID (8 characters)
 * with fallback for environments where crypto.randomUUID is not available
 */
export function generateShortUUID(): string {
  // Check if crypto.randomUUID is available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  
  // Fallback implementation for browsers without crypto.randomUUID
  return Math.random().toString(36).substring(2, 10);
}
