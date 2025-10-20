import RecipeDetailClient from './client';

export async function generateStaticParams() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
    const response = await fetch(`${apiUrl}/api/recipes`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch recipes for static params');
      // Fallback to mock IDs for static export
      return [
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '4' },
      ];
    }
    
    const recipes = await response.json();
    return recipes.map((recipe: { id: number }) => ({
      id: recipe.id.toString(),
    }));
  } catch (error) {
    console.error('Error generating static params:', error);
    // Fallback to mock IDs for static export when API is unavailable
    return [
      { id: '1' },
      { id: '2' },
      { id: '3' },
      { id: '4' },
    ];
  }
}

interface PageParams {
  id: string;
}

export default async function RecipeDetailPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  return <RecipeDetailClient id={id} />;
}

