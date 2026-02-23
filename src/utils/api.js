// Centralized API configuration
// This allows for easy changing of the backend URL (e.g., for deployment or network access)

export const API_BASE_URL = 'http://localhost:3001';

/**
 * Helper to construct full API URLs
 * @param {string} endpoint - The path (e.g., '/api/chapters')
 * @returns {string} Full URL
 */
export const getApiUrl = (endpoint) => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
};
