import type {
  CalendarContextMapping,
  CalendarEventContextOverride,
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

/** Projects are global in JEONG. Context applies to schedules/tasks, not to projects. */
export function filterProjectsByContext(projects: Project[], _contexts: Context[], _filter: ContextFilterValue) {
  return projects;
}

type CalendarEventRef = { id?: string; recurringEventId?: string; calendarId?: string; contextId?: string; colorId?: string };

export function calendarEventContextKey(event: CalendarEventRef) {
  const calendarId = event.calendarId || "primary";
  const stableId = event.recurringEventId || event.id || "";
  return stableId ? `${calendarId}:${stableId}` : "";
}

export function getEventContextId(
  overrides: CalendarEventContextOverride[],
  mappings: CalendarContextMapping[],
  event: CalendarEventRef,
) {
  if (event.contextId) return event.contextId;
  const key = calendarEventContextKey(event);
  const override = key ? overrides.find((item) => item.eventKey === key) : undefined;
  const colorContext = event.colorId === "5" ? "personal" : event.colorId === "9" ? "work" : event.colorId === "3" ? "church" : undefined;
  return override?.contextId ?? colorContext ?? getCalendarContextId(mappings, event.calendarId);
}

export function filterCalendarEventsByContext<T extends CalendarEventRef>(
  events: T[],
  mappings: CalendarContextMapping[],
  contexts: Context[],
  filter: ContextFilterValue,
  overrides: CalendarEventContextOverride[] = [],
) {
  const contextId = contextIdForFilter(contexts, filter);
  if (!contextId) return events;
  return events.filter((event) => getEventContextId(overrides, mappings, event) === contextId);
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
