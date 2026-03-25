import EditRecipeClient from './client';

export const dynamic = 'force-dynamic';

interface PageParams {
  id: string;
}

export default async function EditRecipePage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  return <EditRecipeClient id={id} />;
}
