import RecipeDetailClient from './client';

export async function generateStaticParams() {
  // Default fallback for static export when API is unavailable
  const fallbackParams = [
    { id: '1' },
    { id: '2' },
    { id: '3' },
    { id: '4' },
  ];

  // Only attempt to fetch recipes in local development
  if (process.env.NODE_ENV !== 'production') {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
      const response = await fetch(`${apiUrl}/api/recipes`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        const recipes = await response.json();
        return recipes.map((recipe: { id: number }) => ({
          id: recipe.id.toString(),
        }));
      }
    } catch {
      // Silently fall back to mock data in production build
    }
  }

  return fallbackParams;
}

interface PageParams {
  id: string;
}

export default function RecipeDetailPage({ params }: { params: PageParams }) {
  return <RecipeDetailClient id={params.id} />;
}

