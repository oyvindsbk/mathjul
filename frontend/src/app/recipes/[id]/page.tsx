import RecipeDetailClient from './client';
import { recipeService } from '@/lib/services/recipe.service';

export async function generateStaticParams() {
  const ids = await recipeService.getRecipeIds();
  return ids.map((id) => ({
    id: id.toString(),
  }));
}

interface PageParams {
  id: string;
}

export default async function RecipeDetailPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  return <RecipeDetailClient id={id} />;
}

