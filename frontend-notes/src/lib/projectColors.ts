/** The palette keys the API accepts (NotesApi ProjectColors.All), with their Norwegian names. */
export const PROJECT_COLORS = [
  { key: 'blue', name: 'Blå' },
  { key: 'yellow', name: 'Gul' },
  { key: 'green', name: 'Grønn' },
  { key: 'red', name: 'Rød' },
  { key: 'purple', name: 'Lilla' },
  { key: 'cyan', name: 'Turkis' },
  { key: 'orange', name: 'Oransje' },
  { key: 'magenta', name: 'Rosa' },
  { key: 'teal', name: 'Blågrønn' },
  { key: 'gray', name: 'Grå' },
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number]['key'];

/** CSS value for a palette key; the light and dark values live in globals.css. */
export const projectColorVar = (color: ProjectColor) => `var(--project-${color})`;

export const projectColorName = (color: ProjectColor | null) =>
  PROJECT_COLORS.find((c) => c.key === color)?.name ?? 'Ingen farge';
