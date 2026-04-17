import { appConfig } from '../config';

export type Leverandor = 'Hellofresh' | 'Kokkeloren' | 'GodtLevert';

export const LEVERANDOR_LABELS: Record<Leverandor, string> = {
  Hellofresh: 'HelloFresh',
  Kokkeloren: 'Kokkeløren',
  GodtLevert: 'Godt Levert',
};

export const LEVERANDOR_COLORS: Record<Leverandor, { bg: string; text: string; border: string }> = {
  Hellofresh: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  Kokkeloren: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  GodtLevert: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
};

export interface MatkasseRecipe {
  id: number;
  tittel: string;
  beskrivelse: string | null;
  leverandor: Leverandor;
  ukeStart: string; // yyyy-MM-dd
  imageUrl: string | null;
}

export interface MatkasseFromImagesResponse {
  recipes: MatkasseRecipe[];
}

class MatkasseService {
  async getMatkasseRecipes(groupId: number, weekStart: string, token: string): Promise<MatkasseRecipe[]> {
    const url = new URL(`${appConfig.api.baseUrl}/api/matkasse`);
    url.searchParams.set('groupId', String(groupId));
    url.searchParams.set('weekStart', weekStart);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Kunne ikke hente matkasseoppskrifter');
    return res.json();
  }

  async uploadImages(
    files: File[],
    leverandor: Leverandor,
    groupId: number,
    weekStart: string,
    token: string
  ): Promise<MatkasseRecipe[]> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('images', file);
    }
    formData.append('leverandor', leverandor);
    formData.append('groupId', String(groupId));
    formData.append('weekStart', weekStart);

    const res = await fetch(`${appConfig.api.baseUrl}/api/matkasse/from-images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? 'Kunne ikke analysere bilder');
    }

    const data = (await res.json()) as MatkasseFromImagesResponse;
    return data.recipes;
  }

  async deleteMatkasseRecipe(id: number, token: string): Promise<void> {
    const res = await fetch(`${appConfig.api.baseUrl}/api/matkasse/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Kunne ikke slette matkasseoppskrift');
  }
}

export const matkasseService = new MatkasseService();
