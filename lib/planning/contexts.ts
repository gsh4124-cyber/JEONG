import type {
  CalendarContextMapping,
  Context,
  ContextCalendarPreference,
  ContextFilterValue,
  Project,
  TaskItem,
} from "./types";

export const DEFAULT_CONTEXTS: Context[] = [
  { id: "personal", key: "PERSONAL", name: "개인", icon: "◉", color: "gold", sortOrder: 10, isActive: true },
  { id: "work", key: "WORK", name: "직장", icon: "▣", color: "blue", sortOrder: 20, isActive: true },
  { id: "church", key: "CHURCH", name: "교회", icon: "◇", color: "violet", sortOrder: 30, isActive: true },
];

export const contextIdForFilter = (contexts: Context[], filter: ContextFilterValue) =>
  filter === "ALL" ? undefined : contexts.find((context) => context.key === filter)?.id;

export function filterTasksByContext(tasks: TaskItem[], contexts: Context[], filter: ContextFilterValue) {
  const contextId = contextIdForFilter(contexts, filter);
  return contextId ? tasks.filter((task) => task.contextId === contextId) : tasks;
}

export function filterProjectsByContext(projects: Project[], contexts: Context[], filter: ContextFilterValue) {
  const contextId = contextIdForFilter(contexts, filter);
  return contextId ? projects.filter((project) => project.contextId === contextId) : projects;
}

export function filterCalendarEventsByContext<T extends { calendarId?: string }>(
  events: T[],
  mappings: CalendarContextMapping[],
  contexts: Context[],
  filter: ContextFilterValue,
) {
  const contextId = contextIdForFilter(contexts, filter);
  if (!contextId) return events;
  const calendarIds = new Set(mappings.filter((mapping) => mapping.contextId === contextId).map((mapping) => mapping.calendarId));
  return events.filter((event) => !!event.calendarId && calendarIds.has(event.calendarId));
}

export function getCalendarContextId(mappings: CalendarContextMapping[], calendarId?: string) {
  return calendarId ? mappings.find((mapping) => mapping.calendarId === calendarId)?.contextId : undefined;
}

export function getDefaultCalendarId(
  preferences: ContextCalendarPreference[],
  mappings: CalendarContextMapping[],
  contextId: string,
  fallback: string,
) {
  const preferred = preferences.find((preference) => preference.contextId === contextId)?.defaultCalendarId;
  if (preferred) return preferred;
  return mappings.find((mapping) => mapping.contextId === contextId)?.calendarId ?? fallback;
}
