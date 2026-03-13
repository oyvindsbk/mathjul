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
    // Enable mock data only when explicitly requested via NEXT_PUBLIC_MOCK_DATA=true.
    // This prevents silently defaulting to mock data during development.
    enabled: process.env.NEXT_PUBLIC_MOCK_DATA === 'true',

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
