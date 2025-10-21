/**
 * Global application configuration
 * Controls behavior across the app (API endpoints, mocking, etc.)
 */

export const appConfig = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238',
  },

  // Mock Configuration
  mocking: {
    // Enable mock data by default in development only
    // In production, no fallback to mocks - API errors will be handled by error boundaries
    enabled: process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_MOCK_DATA !== 'false',
    
    // Timeout (ms) before considering API unavailable
    fetchTimeout: 5000,
  },

  // Feature Flags
  features: {
    // Add feature flags here as needed
    enableRecipeDetails: true,
    enableSpinWheel: true,
  },
} as const;

export type AppConfig = typeof appConfig;
