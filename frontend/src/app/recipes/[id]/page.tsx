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
      return [];
    }
    
    const recipes = await response.json();
    return recipes.map((recipe: { id: number }) => ({
      id: recipe.id.toString(),
    }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

interface PageParams {
  id: string;
}

export default function RecipeDetailPage({ params }: { params: PageParams }) {
  return <RecipeDetailClient id={params.id} />;
}

