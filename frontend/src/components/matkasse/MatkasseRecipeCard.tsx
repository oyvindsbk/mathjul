import { LEVERANDOR_COLORS, LEVERANDOR_LABELS, type MatkasseRecipe } from '@/lib/services/matkasse.service';

interface Props {
  recipe: MatkasseRecipe;
  onDelete: (id: number) => void;
}

export function MatkasseRecipeCard({ recipe, onDelete }: Props) {
  const colors = LEVERANDOR_COLORS[recipe.leverandor] ?? { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
  const label = LEVERANDOR_LABELS[recipe.leverandor] ?? recipe.leverandor;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("matkasseRecipeId", String(recipe.id));
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group cursor-grab active:cursor-grabbing active:opacity-70"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
            {label}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-900 truncate">{recipe.tittel}</p>
        {recipe.beskrivelse && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{recipe.beskrivelse}</p>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button
          onClick={() => onDelete(recipe.id)}
          className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
          title="Slett"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
