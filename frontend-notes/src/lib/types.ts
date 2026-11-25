export type ItemKind = 'Todo' | 'Note';
export type ItemState = 'Open' | 'Done' | 'Carried';

export interface Item {
  id: number;
  kind: ItemKind;
  text: string;
  state: ItemState;
  indent: number;
  sortOrder: number;
  projectId: number | null;
  /** The date of the item this was carried from, as yyyy-mm-dd. */
  carriedFromDate: string | null;
  completedAt: string | null;
  /** Client-only stable React key, so a row created optimistically keeps focus when its real id arrives. */
  clientKey?: string;
}

export interface Day {
  date: string;
  isToday: boolean;
  items: Item[];
}

export interface DaySummary {
  date: string;
  open: number;
  done: number;
  carried: number;
  notes: number;
}

export interface Week {
  week: string;
  monday: string;
  today: string;
  days: DaySummary[];
}

export interface Project {
  id: number;
  name: string;
  sortOrder: number;
  isArchived: boolean;
}

export const MAX_INDENT = 6;
