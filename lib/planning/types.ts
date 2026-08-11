export type ContextKey = "PERSONAL" | "WORK" | "CHURCH";

export type ContextRef = {
  id: string;
  key?: ContextKey;
  name?: string;
};

export type Context = {
  id: string;
  key: ContextKey;
  name: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
};

export type ContextFilterValue = "ALL" | ContextKey;

export type CalendarContextMapping = {
  calendarId: string;
  contextId?: string;
};

export type ContextCalendarPreference = {
  contextId: string;
  defaultCalendarId?: string;
};

export type PlanningHorizon = "DAY" | "WEEK" | "MONTH";
export type Plan = {
  id: string; horizon: "MONTH" | "WEEK"; contextId?: string;
  periodStart: string; periodEnd: string; direction: string; focus?: string[]; reviewNote?: string;
  createdAt: string; updatedAt: string;
};
export type Goal = {
  id: string; contextId?: string; horizon: PlanningHorizon; parentGoalId?: string;
  periodStart: string; periodEnd: string; title: string; description?: string;
  status: "active" | "done" | "paused" | "cancelled";
  priority: "low" | "normal" | "high"; projectId?: string;
  createdAt: string; updatedAt: string;
};
export type TaskBucket = "today" | "week" | "month" | "someday";
export type RecurringTaskPriority = "low" | "normal" | "high";
export type RecurringTaskStatus = "done" | "skipped";
export type RecurrenceRule =
  | { type: "DAILY" }
  | { type: "WEEKDAYS" }
  | { type: "WEEKLY"; weekdays: number[]; interval?: number }
  | { type: "MONTHLY"; dayOfMonth: number };

export type RecurringTaskDefinition = {
  id: string;
  contextId?: string;
  projectId?: string;
  title: string;
  description?: string;
  recurrence: RecurrenceRule;
  startDate: string;
  endDate?: string;
  timeOfDay?: string;
  durationMinutes?: number;
  priority: RecurringTaskPriority;
  showOnCalendar: boolean;
  calendarId?: string;
  calendarEventId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecurringTaskCompletion = {
  recurringTaskId: string;
  occurrenceDate: string;
  status: RecurringTaskStatus;
  completedAt?: string;
  note?: string;
};
export type ActivityType = "running" | "workout" | "martial" | "reading" | "study" | "church" | "photo" | "other";
export type NoteType = "idea" | "thought" | "question" | "principle" | "quote";

export type TaskItem = {
  id: string;
  title: string;
  done: boolean;
  doneAt?: string;
  bucket: TaskBucket;
  scheduledAt: string;
  durationMinutes: number;
  syncCalendar: boolean;
  calendarEventId?: string;
  calendarId?: string;
  projectId?: string;
  contextId?: string;
};

export type Milestone = { id: string; title: string; done: boolean; weight: number };

export type Project = {
  id: string;
  name: string;
  goal: string;
  next: string;
  status: "planning" | "active" | "review" | "done";
  milestones: Milestone[];
  note: string;
  contextId?: string;
};

export type Activity = {
  id: string;
  date: string;
  type: ActivityType;
  title: string;
  duration: number;
  amount: number;
  unit: string;
  note: string;
  learned: string;
  applied: string;
  meta: Record<string, string | number>;
  projectId?: string;
  contextId?: string;
};

export type Note = {
  id: string;
  date: string;
  type: NoteType;
  title: string;
  body: string;
  tags: string[];
  projectId?: string;
  contextId?: string;
};

export type ContactLog = { id: string; date: string; channel: string; summary: string };
export type Person = {
  id: string;
  name: string;
  tags: string[];
  lastContact: string;
  nextContact: string;
  note: string;
  phone?: string;
  email?: string;
  organization?: string;
  source?: string;
  waiting?: boolean;
  logs?: ContactLog[];
};

export type Review = {
  date: string;
  goal: string;
  enjoyment: string;
  status: "done" | "not_done" | "changed" | "";
  reason: string;
  good: string;
  learned: string;
  joy: string;
  gratitude?: string;
  morningGratitude: string[];
  eveningGratitude: string[];
  contextId?: string;
};

export type DailyPlanDraft = {
  morningDate: string;
  goal: string;
  reason: string;
  enjoyment: string;
  gratitude: string[];
  contextId?: string;
  dailyGoalId?: string;
  parentWeeklyGoalId?: string;
};

export type Chapter = { id: string; title: string; startDate: string; endDate: string; description: string; active: boolean };

export type LocalState = DailyPlanDraft & {
  schemaVersion: number;
  tasks: TaskItem[];
  people: Person[];
  projects: Project[];
  activities: Activity[];
  notes: Note[];
  reviews: Record<string, Review>;
  chapters: Chapter[];
  contexts: Context[];
  calendarContextMappings: CalendarContextMapping[];
  contextCalendarPreferences: ContextCalendarPreference[];
  recurringTasks: RecurringTaskDefinition[];
  recurringTaskCompletions: RecurringTaskCompletion[];
  plans: Plan[];
  goals: Goal[];
};
