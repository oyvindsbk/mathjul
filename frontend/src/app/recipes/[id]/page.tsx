import RecipeDetailClient from './client';

// Dynamic rendering for standalone mode with middleware protection
// The middleware ensures only authenticated users can access this page
export const dynamic = 'force-dynamic';

interface PageParams {
  id: string;
}

export default async function RecipeDetailPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  return <RecipeDetailClient id={id} />;
}

