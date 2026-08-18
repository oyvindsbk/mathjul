'use client';

import { useParams } from 'next/navigation';
import RecipeDetailClient from './client';

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <RecipeDetailClient id={id} />;
}

