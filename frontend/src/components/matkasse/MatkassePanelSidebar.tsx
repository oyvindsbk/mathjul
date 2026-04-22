"use client";

import { useEffect, useRef, useState } from "react";
import { matkasseService, LEVERANDOR_LABELS, type Leverandor, type MatkasseRecipe } from "@/lib/services/matkasse.service";
import { MatkasseRecipeCard } from "./MatkasseRecipeCard";

const LEVERANDORER: Leverandor[] = ["Hellofresh", "Kokkeloren", "GodtLevert"];

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const weekNum = getISOWeekNumber(monday);
  return `Uke ${weekNum} (${monday.toLocaleDateString("nb-NO", opts)} – ${sunday.toLocaleDateString("nb-NO", opts)})`;
}

interface Props {
  token: string;
  groupId: number;
  activeDayDate: Date | null;
  onAddToWeek: (recipes: MatkasseRecipe[], weekMonday: Date) => Promise<void>;
  onWeekChange?: (monday: Date) => void;
  usedRecipeIds?: Set<number>;
}

export function MatkassePanelSidebar({ token, groupId, activeDayDate, onAddToWeek, onWeekChange, usedRecipeIds }: Props) {
  const [leverandor, setLeverandor] = useState<Leverandor>("Hellofresh");
  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOfWeek(activeDayDate ?? new Date()));
  const [recipes, setRecipes] = useState<MatkasseRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync weekMonday when activeDayDate changes
  useEffect(() => {
    if (activeDayDate) {
      setWeekMonday(getMondayOfWeek(activeDayDate));
    }
  }, [activeDayDate]);

  // Notify parent of week changes for calendar highlighting
  useEffect(() => {
    onWeekChange?.(weekMonday);
  }, [weekMonday, onWeekChange]);

  // Load existing matkasse recipes for selected week
  useEffect(() => {
    setLoading(true);
    setError(null);
    matkasseService
      .getMatkasseRecipes(groupId, formatDate(weekMonday), token)
      .then(setRecipes)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Feil ved lasting"))
      .finally(() => setLoading(false));
  }, [groupId, weekMonday, token]);

  function handleFilesSelect(files: File[]) {
    const valid = files.filter((f) => f.type.startsWith("image/")).slice(0, 5 - selectedFiles.length);
    if (valid.length === 0) return;
    const combined = [...selectedFiles, ...valid].slice(0, 5);
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setSelectedFiles(combined);
    setPreviewUrls(combined.map((f) => URL.createObjectURL(f)));
    setError(null);
  }

  async function handleUpload() {
    if (selectedFiles.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const newRecipes = await matkasseService.uploadImages(selectedFiles, leverandor, groupId, formatDate(weekMonday), token);
      setRecipes((prev) => [...prev, ...newRecipes]);
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
      setSelectedFiles([]);
      setPreviewUrls([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil ved opplasting");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await matkasseService.deleteMatkasseRecipe(id, token);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Feil ved sletting");
    }
  }

  async function handleAddToWeek() {
    if (recipes.length === 0) return;
    await onAddToWeek(recipes, weekMonday);
  }

  const weekStr = formatDate(weekMonday);
  const weekRecipes = recipes.filter((r) => r.ukeStart === weekStr && !(usedRecipeIds?.has(r.id)));

  return (
    <div className="flex flex-col gap-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setWeekMonday((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
          title="Forrige uke"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-medium text-gray-700 text-center flex-1">{formatWeekLabel(weekMonday)}</span>
        <button
          onClick={() => setWeekMonday((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
          title="Neste uke"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Leverandør tabs */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
        {LEVERANDORER.map((l) => (
          <button
            key={l}
            onClick={() => setLeverandor(l)}
            className={`flex-1 py-1.5 font-medium transition-colors ${
              leverandor === l ? "bg-blue-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {LEVERANDOR_LABELS[l]}
          </button>
        ))}
      </div>

      {/* Image upload */}
      <div
        className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFilesSelect(Array.from(e.dataTransfer.files)); }}
        onPaste={(e) => {
          const images = Array.from(e.clipboardData.items)
            .filter((i) => i.type.startsWith('image/'))
            .map((i) => i.getAsFile())
            .filter((f): f is File => f !== null);
          if (images.length > 0) handleFilesSelect(images);
        }}
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFilesSelect(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
        {previewUrls.length === 0 ? (
          <div>
            <p className="text-xs text-gray-500 mb-2">Last opp menybilde fra {LEVERANDOR_LABELS[leverandor]}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
            >
              Velg bilder
            </button>
            <p className="text-xs text-gray-400 mt-1.5">eller lim inn bilde (Ctrl+V)</p>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2 justify-center mb-2">
              {previewUrls.map((url, i) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Bilde ${i + 1}`} className="h-16 w-16 object-cover rounded-md" />
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(url);
                      setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i));
                      setPreviewUrls((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                  >✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              {selectedFiles.length < 5 && (
                <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                  + Legg til
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
              >
                {uploading ? "Analyserer..." : "Analyser bilder"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1.5">{error}</p>
      )}

      {/* Recipe list */}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-4">Laster...</p>
      ) : weekRecipes.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600">{weekRecipes.length} oppskrift{weekRecipes.length !== 1 ? "er" : ""} denne uken</p>
            <button
              onClick={handleAddToWeek}
              className="text-xs px-2 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              title="Fordel oppskrifter på mandag–onsdag (eller til fredag hvis det er 4–5)"
            >
              Legg til i uke
            </button>
          </div>
          {weekRecipes.map((r) => (
            <MatkasseRecipeCard
              key={r.id}
              recipe={r}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-2">Ingen matkasseoppskrifter for denne uken ennå</p>
      )}
    </div>
  );
}
