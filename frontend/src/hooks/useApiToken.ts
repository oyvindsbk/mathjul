'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthButton';

export function useApiToken() {
  const { isAuthenticated } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      // Only fetch token if user is authenticated
      if (!isAuthenticated) {
        setLoading(false);
        setToken(null);
        return;
      }

      // Check if we already have a valid token in localStorage
      const storedToken = localStorage.getItem('api_token');
      const storedExpiry = localStorage.getItem('api_token_expiry');
      
      if (storedToken && storedExpiry) {
        const expiryTime = parseInt(storedExpiry, 10);
        if (Date.now() < expiryTime) {
          setToken(storedToken);
          setLoading(false);
          return;
        }
      }

      // Fetch new token from backend
      // Important: Call the token endpoint on the SAME domain (Static Web App)
      // so that Static Web Apps authentication headers are included
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        
        // First, try to get token from the Container Apps backend directly
        // This requires the X-MS-CLIENT-PRINCIPAL header which we need to get from /.auth/me
        const authResponse = await fetch('/.auth/me');
        if (!authResponse.ok) {
          throw new Error('Not authenticated with Static Web Apps');
        }
        
        const authData = await authResponse.json();
        if (!authData.clientPrincipal) {
          throw new Error('No client principal found');
        }

        // Encode the client principal as base64 to send to backend
        const principalJson = JSON.stringify(authData.clientPrincipal);
        const principalBase64 = btoa(principalJson);

        const response = await fetch(`${apiBaseUrl}/api/auth/token`, {
          method: 'POST',
          headers: {
            'X-MS-CLIENT-PRINCIPAL': principalBase64,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch API token');
        }

        const data = await response.json();
        const { token: newToken, expiresIn } = data;

        // Store token and expiry time
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem('api_token', newToken);
        localStorage.setItem('api_token_expiry', expiryTime.toString());

        setToken(newToken);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch token';
        setError(errorMsg);
        console.error('Token fetch error:', errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [isAuthenticated]);

  const clearToken = () => {
    localStorage.removeItem('api_token');
    localStorage.removeItem('api_token_expiry');
    setToken(null);
  };

  return {
    token,
    loading,
    error,
    clearToken,
    isReady: !loading && !!token,
  };
}
