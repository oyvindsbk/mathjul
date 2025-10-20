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
    // Enable mock data fallback when API is unavailable
    // In production builds, this is always true to ensure static export works
    enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_MOCK_DATA === 'true',
    
    // Timeout (ms) before falling back to mock data
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
