import type { Recipe, WeekPlan } from './types';
import { DAYS_OF_WEEK } from './types';

const CUSTOM_PREFIX = 'custom:';
const EVENTS_API =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';

// Order of meal slots within a day's calendar event, with display labels.
const MEAL_SLOTS: { key: 'main' | 'vegetable' | 'grain' | 'other'; label: string }[] = [
  { key: 'main', label: 'Main' },
  { key: 'vegetable', label: 'Vegetable' },
  { key: 'grain', label: 'Grain' },
  { key: 'other', label: 'Other' },
];

export interface SyncOptions {
  /** Used to namespace event IDs so re-syncing updates events instead of duplicating. */
  familyId: string;
  /** Local hour for the dinner event start, 24h (e.g. 18 = 6pm). */
  hour: number;
  /** Event length in minutes. */
  durationMinutes?: number;
  /** Popup reminder this many minutes before the start. */
  reminderMinutes?: number;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  failed: number;
}

/** Thrown when the access token is rejected, so the UI can prompt to re-connect. */
export class CalendarAuthError extends Error {}

interface ResolvedMeal {
  label: string;
  name: string;
  url?: string;
}

// A meal value is either a recipe ID or a `custom:` payload (JSON, or plain text
// for older entries). Mirror the encoding used in WeekPlanner.
function resolveMeal(
  value: string,
  label: string,
  recipes: Recipe[]
): ResolvedMeal | null {
  if (!value) return null;

  if (value.startsWith(CUSTOM_PREFIX)) {
    const raw = value.slice(CUSTOM_PREFIX.length);
    try {
      const parsed = JSON.parse(raw) as { name?: string; url?: string };
      const name = parsed.name?.trim();
      if (!name) return null;
      return { label, name, url: parsed.url?.trim() || undefined };
    } catch {
      const name = raw.trim();
      return name ? { label, name } : null;
    }
  }

  const recipe = recipes.find((r) => r.id === value);
  if (!recipe) return null;
  return { label, name: recipe.name, url: recipe.url?.trim() || undefined };
}

// Build a deterministic, valid Google Calendar event ID. Allowed characters are
// base32hex (a-v, 0-9); hex (0-9a-f) is a valid subset, so hex-encoding the
// ASCII namespace string is always safe.
function toEventId(parts: string): string {
  let hex = '';
  for (let i = 0; i < parts.length; i++) {
    hex += parts.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return 'meal' + hex;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Create the event, or update it if one with this ID already exists (so repeated
// syncs are idempotent rather than piling up duplicates).
async function upsertEvent(
  token: string,
  id: string,
  body: Record<string, unknown>
): Promise<'created' | 'updated' | 'failed'> {
  const insertRes = await fetch(EVENTS_API, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ id, ...body }),
  });
  if (insertRes.ok) return 'created';
  if (insertRes.status === 401) throw new CalendarAuthError();
  if (insertRes.status === 409) {
    // Event already exists (or was previously deleted) — update revives/refreshes it.
    const updateRes = await fetch(`${EVENTS_API}/${id}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ ...body, status: 'confirmed' }),
    });
    if (updateRes.status === 401) throw new CalendarAuthError();
    return updateRes.ok ? 'updated' : 'failed';
  }
  return 'failed';
}

// Remove a previously-synced event (e.g. the meal was cleared). A 404/410 means
// it was never created or already gone, which is fine.
async function deleteEvent(token: string, id: string): Promise<boolean> {
  const res = await fetch(`${EVENTS_API}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (res.status === 401) throw new CalendarAuthError();
  return res.status === 204;
}

/**
 * Push one week of meals to the user's primary Google Calendar as dinner events.
 * Each day with meals becomes a single event; days that are empty have any
 * previously-synced event removed. Idempotent: safe to run repeatedly.
 */
export async function syncWeekToCalendar(
  accessToken: string,
  weekStart: string,
  days: WeekPlan['days'],
  recipes: Recipe[],
  options: SyncOptions
): Promise<SyncResult> {
  const { familyId, hour, durationMinutes = 60, reminderMinutes = 60 } = options;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [year, month, dayOfMonth] = weekStart.split('-').map(Number);
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, failed: 0 };

  for (let i = 0; i < DAYS_OF_WEEK.length; i++) {
    const day = DAYS_OF_WEEK[i];
    const meal = days[day];
    const eventId = toEventId(`${familyId}|${weekStart}|${day}`);

    const components = MEAL_SLOTS.map((slot) =>
      resolveMeal(meal[slot.key] || '', slot.label, recipes)
    ).filter((c): c is ResolvedMeal => c !== null);

    if (components.length === 0) {
      if (await deleteEvent(accessToken, eventId)) result.deleted++;
      continue;
    }

    // DAYS_OF_WEEK starts on Saturday (the weekStart date), so index = day offset.
    const start = new Date(year, month - 1, dayOfMonth + i, hour, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60000);

    const main = components.find((c) => c.label === 'Main');
    const summary = `🍽 ${main ? main.name : components.map((c) => c.name).join(' + ')}`;
    const description = components
      .map((c) => (c.url ? `${c.label}: ${c.name}\n${c.url}` : `${c.label}: ${c.name}`))
      .join('\n\n');

    const outcome = await upsertEvent(accessToken, eventId, {
      summary,
      description,
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: reminderMinutes }],
      },
    });

    if (outcome === 'created') result.created++;
    else if (outcome === 'updated') result.updated++;
    else result.failed++;
  }

  return result;
}
