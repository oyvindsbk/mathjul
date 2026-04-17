/**
 * Centralized fetch wrapper that handles 401 responses by clearing
 * auth state and redirecting to the login page.
 */

function handleUnauthorized(): never {
  // Clear auth state
  if (typeof window !== 'undefined') {
    localStorage.removeItem('jwt_token');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax';
    window.location.href = '/login';
  }
  throw new Error('Session expired');
}

/**
 * Wrapper around fetch that automatically redirects to login on 401.
 * Use this for all authenticated API calls.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    handleUnauthorized();
  }
  return response;
}
