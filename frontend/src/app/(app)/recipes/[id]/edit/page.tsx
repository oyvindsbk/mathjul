'use client';

import { useParams } from 'next/navigation';
import EditRecipeClient from './client';

export default function EditRecipePage() {
  const { id } = useParams<{ id: string }>();
  return <EditRecipeClient id={id} />;
}
