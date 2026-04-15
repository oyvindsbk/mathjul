"use client";

export const MEAL_TYPES = [
  "Alle",
  "Frokost",
  "Lunsj",
  "Middag",
  "Dessert",
  "Kveldsmat",
  "Søtbakst",
  "Snacks",
  "Drikke",
] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_ICONS: Record<string, string> = {
  Frokost: "🌅",
  Lunsj: "🥗",
  Middag: "🍽️",
  Dessert: "🍰",
  Kveldsmat: "🌙",
  Søtbakst: "🥐",
  Snacks: "🍿",
  Drikke: "🥤",
};

interface MealTypeFilterProps {
  value: MealType;
  onChange: (value: MealType) => void;
}

export function MealTypeFilter({ value, onChange }: MealTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {MEAL_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
            value === type
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
          }`}
        >
          {type !== "Alle" && MEAL_TYPE_ICONS[type] ? `${MEAL_TYPE_ICONS[type]} ` : ""}
          {type}
        </button>
      ))}
    </div>
  );
}
