import { getProjectIntelligence, type ProjectIntelligence } from "./project-intelligence";
import type { Activity, Context, Goal, Note, PersonalInsightPreference, Plan, Project, RecurringTaskCompletion, RecurringTaskDefinition, Review, TaskItem } from "./types";
import { getRoutineIntelligence, type RoutineIntelligence } from "./routine-intelligence";

/** A pattern needs repetition, not a single unusual day. */
export const MIN_PATTERN_OCCURRENCES = 3;
export const MIN_PATTERN_DAYS = 7;
export const MIN_PATTERN_WEEKS = 3;

export type IntelligenceEvent = { id: string; start: string; end?: string; title?: string };
export type InsightPriority = "high" | "medium" | "low";
export type PersonalInsight = {
  id: string;
  type: "repeated_carry" | "overdue" | "weekday_load" | "planning_gap" | "stalled_project" | "morning_comparison" | "routine_consistency";
  priority: InsightPriority;
  period: { start: string; end: string };
  evidence: string;
  sampleSize: number;
  confidence: "insufficient" | "limited" | "moderate" | "strong";
  summary: string;
  relatedEntityIds: string[];
  generatedAt: string;
};

export type PersonalIntelligence = {
  windows: { recent7: { start: string; end: string }; recent30: { start: string; end: string }; recent4Weeks: { start: string; end: string }; recent3Months: { start: string; end: string } };
  period: { start: string; end: string; days: number };
  insights: PersonalInsight[];
  visibleInsights: PersonalInsight[];
  todo: {
    total: number; completed: number; completionRate: number;
    weekday: Array<{ weekday: number; planned: number; completed: number; completionRate: number }>;
    carryCount: number; overdue: number; repeatedCarry: TaskItem[];
    byContext: Array<{ contextId: string; name: string; total: number; completed: number; completionRate: number; carries: number; overdue: number }>;
  };
  routine: RoutineIntelligence;
  calendar: { available: boolean; count: number; minutes: number; busiestWeekday?: number; quietWeekday?: number; weekdayCounts: number[] };
  records: { morningDirections: number; eveningReviews: number; enjoymentRecords: number; gratitudeRecords: number; morningCompletion?: { written: number; notWritten: number } };
  projects: { active: ProjectIntelligence[]; stalled: ProjectIntelligence[]; mostActive?: string };
  goalAction: { total: number; connectedToProject: number; connectedToChildGoal: number };
  comparison: { previous: { start: string; end: string }; todoRateDelta: number; carryDelta: number; overdueDelta: number; calendarMinutesDelta: number; morningDelta: number; reviewDelta: number };
  planningSignals: {
    typicalTodoCapacity: { average: number; median: number; sampleDays: number } | null;
    calendarCapacityMinutes: { median: number; sampleDays: number } | null;
    planningGap: { plannedPerDay: number; completedPerDay: number; gap: number; sampleDays: number } | null;
    overloadedWeekdays: number[] | null;
    freeWeekdays: number[] | null;
    recurringCarry: TaskItem[];
    activeProjects: string[];
  };
};

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (value: string, offset: number) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + offset); return dayKey(date); };
const inRange = (value: string | undefined, start: string, end: string) => Boolean(value && value.slice(0, 10) >= start && value.slice(0, 10) <= end);
const daysIn = (start: string, end: string) => { const values: string[] = []; for (let date = start; date <= end; date = addDays(date, 1)) values.push(date); return values; };
const median = (values: number[]) => { const ordered = [...values].sort((a, b) => a - b); if (!ordered.length) return 0; const center = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[center] : (ordered[center - 1] + ordered[center]) / 2; };
const confidence = (sample: number): PersonalInsight["confidence"] => sample >= 60 ? "strong" : sample >= 28 ? "moderate" : sample >= MIN_PATTERN_DAYS ? "limited" : "insufficient";
const weekdayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const durationMinutes = (event: IntelligenceEvent) => Math.max(0, (new Date(event.end ?? event.start).getTime() - new Date(event.start).getTime()) / 60_000);

type Source = { start: string; end: string; now: Date; tasks: TaskItem[]; recurringTasks?: RecurringTaskDefinition[]; recurringTaskCompletions?: RecurringTaskCompletion[]; events: IntelligenceEvent[]; contexts: Context[]; projects: Project[]; goals: Goal[]; reviews: Record<string, Review>; activities?: Activity[]; notes?: Note[] };
function collect(input: Source) {
  const days = daysIn(input.start, input.end);
  const touches = input.tasks.filter(task => inRange(task.scheduledAt, input.start, input.end) || inRange(task.originalScheduledDate, input.start, input.end) || inRange(task.doneAt, input.start, input.end) || (task.carryHistory ?? []).some(date => inRange(date, input.start, input.end)));
  const scheduled = touches.filter(task => inRange(task.scheduledAt, input.start, input.end) || inRange(task.originalScheduledDate, input.start, input.end));
  const completed = touches.filter(task => task.done && inRange(task.doneAt, input.start, input.end));
  const carries = touches.reduce((total, task) => total + (task.carryHistory?.filter(date => inRange(date, input.start, input.end)).length ?? 0), 0);
  const repeatedCarry = touches.filter(task => (task.carryHistory?.filter(date => inRange(date, input.start, input.end)).length ?? 0) >= MIN_PATTERN_OCCURRENCES);
  const overdue = touches.filter(task => !task.done && Boolean(task.dueDate && task.dueDate.slice(0, 10) < input.end));
  const weekday = Array.from({ length: 7 }, (_, value) => {
    const planned = scheduled.filter(task => new Date(`${(task.scheduledAt || task.originalScheduledDate || "").slice(0, 10)}T12:00:00`).getDay() === value).length;
    const done = completed.filter(task => new Date(`${task.doneAt!.slice(0, 10)}T12:00:00`).getDay() === value).length;
    return { weekday: value, planned, completed: done, completionRate: planned ? Math.round(done / planned * 100) : 0 };
  });
  const byContext = input.contexts.map(context => {
    const contextTasks = touches.filter(task => task.contextId === context.id);
    const contextDone = completed.filter(task => task.contextId === context.id);
    return { contextId: context.id, name: context.name, total: contextTasks.length, completed: contextDone.length, completionRate: contextTasks.length ? Math.round(contextDone.length / contextTasks.length * 100) : 0, carries: contextTasks.reduce((total, task) => total + (task.carryHistory?.filter(date => inRange(date, input.start, input.end)).length ?? 0), 0), overdue: contextTasks.filter(task => !task.done && Boolean(task.dueDate && task.dueDate.slice(0, 10) < input.end)).length };
  }).filter(row => row.total);
  const events = input.events.filter(event => inRange(event.start, input.start, input.end));
  const weekdayCounts = Array.from({ length: 7 }, () => 0);
  const calendarDaily = new Map<string, number>();
  events.forEach(event => { const date = event.start.slice(0, 10); const weekday = new Date(`${date}T12:00:00`).getDay(); weekdayCounts[weekday]++; calendarDaily.set(date, (calendarDaily.get(date) ?? 0) + durationMinutes(event)); });
  const reviewEntries = Object.entries(input.reviews).filter(([date]) => inRange(date, input.start, input.end));
  const morningDays = input.goals.filter(goal => goal.horizon === "DAY" && inRange(goal.periodStart, input.start, input.end)).map(goal => goal.periodStart);
  const completionFor = (date: string) => { const planned = scheduled.filter(task => (task.scheduledAt || task.originalScheduledDate || "").slice(0, 10) === date).length; const done = completed.filter(task => task.doneAt?.slice(0, 10) === date).length; return planned ? done / planned : undefined; };
  const writtenRates = morningDays.map(completionFor).filter((value): value is number => value !== undefined);
  const unwrittenRates = days.filter(date => !morningDays.includes(date)).map(completionFor).filter((value): value is number => value !== undefined);
  const projects = input.projects.map(project => getProjectIntelligence({ project, tasks: input.tasks, goals: input.goals, activities: input.activities, notes: input.notes, now: input.now }));
  const activity = input.projects.map(project => ({
    name: project.name,
    count: new Set(touches.filter(task => task.projectId === project.id).map(task => task.id)).size
      + (input.activities ?? []).filter(item => item.projectId === project.id && inRange(item.date, input.start, input.end)).length
      + (input.notes ?? []).filter(item => item.projectId === project.id && inRange(item.date, input.start, input.end)).length,
  })).sort((a, b) => b.count - a.count)[0];
  const routine = getRoutineIntelligence({ start:input.start, end:input.end, routines:input.recurringTasks, completions:input.recurringTaskCompletions, now:input.now });
  return { days, touches, scheduled, completed, carries, repeatedCarry, overdue, weekday, byContext, events, weekdayCounts, calendarDaily, reviewEntries, morningDays, writtenRates, unwrittenRates, projects, activity, routine };
}

export function getPersonalIntelligence(input: { now?: Date; tasks: TaskItem[]; events?: IntelligenceEvent[]; contexts: Context[]; projects: Project[]; goals: Goal[]; reviews: Record<string, Review>; plans: Plan[]; activities?: Activity[]; notes?: Note[]; preferences?: PersonalInsightPreference[]; recurringTasks?: RecurringTaskDefinition[]; recurringTaskCompletions?: RecurringTaskCompletion[] }): PersonalIntelligence {
  const now = input.now ?? new Date();
  const end = dayKey(now); const start = addDays(end, -29); const priorEnd = addDays(start, -1); const priorStart = addDays(priorEnd, -29);
  const source = { now, tasks: input.tasks, events: input.events ?? [], contexts: input.contexts, projects: input.projects, goals: input.goals, reviews: input.reviews, activities: input.activities, notes: input.notes, recurringTasks:input.recurringTasks, recurringTaskCompletions:input.recurringTaskCompletions };
  const current = collect({ ...source, start, end }); const previous = collect({ ...source, start: priorStart, end: priorEnd });
  const sample = current.days.length; const generatedAt = now.toISOString(); const insights: PersonalInsight[] = [];
  current.repeatedCarry.slice(0, 3).forEach(task => {
    const count = task.carryHistory?.filter(date => inRange(date, start, end)).length ?? 0;
    insights.push({ id: `carry:${task.id}:${start}:${end}`, type: "repeated_carry", priority: "high", period: { start, end }, evidence: `carry count: ${count}`, sampleSize: sample, confidence: confidence(sample), summary: `${task.title}: carried forward ${count} times in the recent 30-day range.`, relatedEntityIds: [task.id], generatedAt });
  });
  if (current.overdue.length >= MIN_PATTERN_OCCURRENCES) {
    insights.push({ id: `overdue:${start}:${end}`, type: "overdue", priority: "high", period: { start, end }, evidence: `overdue Todo: ${current.overdue.length}`, sampleSize: sample, confidence: confidence(sample), summary: `There are ${current.overdue.length} incomplete overdue Todo items in the recent 30-day range.`, relatedEntityIds: current.overdue.map(task => task.id), generatedAt });
  }
  const busy = [...current.weekday].sort((a, b) => b.planned - a.planned)[0];
  if (busy && busy.planned >= MIN_PATTERN_OCCURRENCES) {
    insights.push({ id: `weekday:${busy.weekday}:${start}:${end}`, type: "weekday_load", priority: "medium", period: { start, end }, evidence: `${weekdayNames[busy.weekday]} planned Todo: ${busy.planned}`, sampleSize: current.weekday.filter(day => day.planned > 0).length, confidence: confidence(current.weekday.filter(day => day.planned > 0).length * 4), summary: `${weekdayNames[busy.weekday]} has the highest number of scheduled Todo items (${busy.planned}) in the recent 30-day record.`, relatedEntityIds: [], generatedAt });
  }
  const plannedPerDay = current.scheduled.length / sample; const completedPerDay = current.completed.length / sample;
  if (current.scheduled.length >= MIN_PATTERN_DAYS && plannedPerDay - completedPerDay >= 1) {
    insights.push({ id: `planning-gap:${start}:${end}`, type: "planning_gap", priority: "medium", period: { start, end }, evidence: `planned/day ${plannedPerDay.toFixed(1)}, completed/day ${completedPerDay.toFixed(1)}`, sampleSize: sample, confidence: confidence(sample), summary: `The recent 30-day record has ${plannedPerDay.toFixed(1)} planned and ${completedPerDay.toFixed(1)} completed Todo items per day.`, relatedEntityIds: [], generatedAt });
  }
  current.projects.filter(project => project.project.status === "active" && project.stalled).forEach(project => {
    insights.push({ id: `stalled:${project.project.id}:${start}:${end}`, type: "stalled_project", priority: "high", period: { start, end }, evidence: "active project without recent activity", sampleSize: sample, confidence: confidence(sample), summary: `${project.project.name} is active but has no recent recorded activity.`, relatedEntityIds: [project.project.id], generatedAt });
  });
  if (current.writtenRates.length >= MIN_PATTERN_OCCURRENCES && current.unwrittenRates.length >= MIN_PATTERN_OCCURRENCES) {
    const written = Math.round(current.writtenRates.reduce((sum, value) => sum + value, 0) / current.writtenRates.length * 100);
    const notWritten = Math.round(current.unwrittenRates.reduce((sum, value) => sum + value, 0) / current.unwrittenRates.length * 100);
    insights.push({ id: `morning:${start}:${end}`, type: "morning_comparison", priority: "low", period: { start, end }, evidence: `written ${written}%, not written ${notWritten}%`, sampleSize: current.writtenRates.length + current.unwrittenRates.length, confidence: confidence(current.writtenRates.length + current.unwrittenRates.length), summary: "Todo completion rates can be compared between days with and without a Morning Direction. This does not imply causality.", relatedEntityIds: [], generatedAt });
  }
  if (current.routine.scheduled >= MIN_PATTERN_DAYS && current.routine.completionRate < 60) {
    const struggling = current.routine.struggling.slice(0, 3);
    insights.push({ id: `routine:${start}:${end}`, type: "routine_consistency", priority: current.routine.completionRate < 40 ? "high" : "medium", period: { start, end }, evidence: `예정 ${current.routine.scheduled}회 중 ${current.routine.completed}회 완료 (${current.routine.completionRate}%)${struggling.length ? `; 낮은 수행률: ${struggling.map(item => item.title).join(", ")}` : ""}`, sampleSize: current.routine.scheduled, confidence: confidence(current.routine.scheduled), summary: `최근 루틴 수행률이 ${current.routine.completionRate}%입니다. 계획량이나 배치 조정이 필요한지 확인할 가치가 있습니다.`, relatedEntityIds: struggling.map(item => item.id), generatedAt });
  }
  const hidden = new Set((input.preferences ?? []).filter(preference => preference.hidden).map(preference => preference.insightId));
  const rate = current.touches.length ? Math.round(current.completed.length / current.touches.length * 100) : 0;
  const previousRate = previous.touches.length ? Math.round(previous.completed.length / previous.touches.length * 100) : 0;
  const calendarMinutes = current.events.reduce((sum, event) => sum + durationMinutes(event), 0); const previousCalendarMinutes = previous.events.reduce((sum, event) => sum + durationMinutes(event), 0);
  const goalAction = { total: input.goals.length, connectedToProject: input.goals.filter(goal => Boolean(goal.projectId)).length, connectedToChildGoal: input.goals.filter(goal => Boolean(goal.parentGoalId)).length };
  const sufficientCalendar = input.events !== undefined && current.events.length >= MIN_PATTERN_DAYS;
  return {
    windows: { recent7: { start: addDays(end, -6), end }, recent30: { start, end }, recent4Weeks: { start: addDays(end, -27), end }, recent3Months: { start: addDays(end, -89), end } },
    period: { start, end, days: sample }, insights, visibleInsights: insights.filter(insight => !hidden.has(insight.id)),
    todo: { total: current.touches.length, completed: current.completed.length, completionRate: rate, weekday: current.weekday, carryCount: current.carries, overdue: current.overdue.length, repeatedCarry: current.repeatedCarry, byContext: current.byContext },
    routine: current.routine,
    calendar: { available: input.events !== undefined, count: current.events.length, minutes: Math.round(calendarMinutes), busiestWeekday: current.events.length ? [...current.weekdayCounts.keys()].sort((a, b) => current.weekdayCounts[b] - current.weekdayCounts[a])[0] : undefined, quietWeekday: current.events.length ? [...current.weekdayCounts.keys()].sort((a, b) => current.weekdayCounts[a] - current.weekdayCounts[b])[0] : undefined, weekdayCounts: current.weekdayCounts },
    records: { morningDirections: current.morningDays.length, eveningReviews: current.reviewEntries.length, enjoymentRecords: current.reviewEntries.filter(([, review]) => Boolean(review.joy || review.enjoyment)).length, gratitudeRecords: current.reviewEntries.filter(([, review]) => Boolean(review.gratitude || review.morningGratitude.some(Boolean) || review.eveningGratitude.some(Boolean))).length, morningCompletion: current.writtenRates.length && current.unwrittenRates.length ? { written: Math.round(current.writtenRates.reduce((sum, value) => sum + value, 0) / current.writtenRates.length * 100), notWritten: Math.round(current.unwrittenRates.reduce((sum, value) => sum + value, 0) / current.unwrittenRates.length * 100) } : undefined },
    projects: { active: current.projects.filter(project => project.project.status === "active"), stalled: current.projects.filter(project => project.project.status === "active" && project.stalled), mostActive: current.activity?.count ? current.activity.name : undefined }, goalAction,
    comparison: { previous: { start: priorStart, end: priorEnd }, todoRateDelta: rate - previousRate, carryDelta: current.carries - previous.carries, overdueDelta: current.overdue.length - previous.overdue.length, calendarMinutesDelta: calendarMinutes - previousCalendarMinutes, morningDelta: current.morningDays.length - previous.morningDays.length, reviewDelta: current.reviewEntries.length - previous.reviewEntries.length },
    planningSignals: { typicalTodoCapacity: current.completed.length >= MIN_PATTERN_DAYS ? { average: Number(completedPerDay.toFixed(1)), median: median(current.days.map(day => current.completed.filter(task => task.doneAt?.slice(0, 10) === day).length)), sampleDays: sample } : null, calendarCapacityMinutes: sufficientCalendar ? { median: median(current.days.map(day => current.calendarDaily.get(day) ?? 0)), sampleDays: sample } : null, planningGap: current.scheduled.length >= MIN_PATTERN_DAYS ? { plannedPerDay: Number(plannedPerDay.toFixed(1)), completedPerDay: Number(completedPerDay.toFixed(1)), gap: Number((plannedPerDay - completedPerDay).toFixed(1)), sampleDays: sample } : null, overloadedWeekdays: current.scheduled.length >= MIN_PATTERN_DAYS ? current.weekday.filter(day => day.planned >= MIN_PATTERN_OCCURRENCES).map(day => day.weekday) : null, freeWeekdays: sufficientCalendar ? current.weekdayCounts.map((count, index) => count === 0 ? index : -1).filter(index => index >= 0) : null, recurringCarry: current.repeatedCarry, activeProjects: current.projects.filter(project => project.project.status === "active").map(project => project.project.name) },
  };
}

export function getPlanningSignals(input: Parameters<typeof getPersonalIntelligence>[0]) { return getPersonalIntelligence(input).planningSignals; }

export function searchEnjoymentReviews(reviews: Record<string, Review>, now = new Date(), days = 30) { const end = dayKey(now); const start = addDays(end, -(days - 1)); return Object.values(reviews).filter(review => inRange(review.date, start, end) && Boolean(review.joy || review.enjoyment)).sort((a, b) => b.date.localeCompare(a.date)); }

/** Read-only answers for the Assistant.  Every sentence is backed by the result above. */
export function answerPersonalQuestion(raw: string, intelligence: PersonalIntelligence, reviews: Record<string, Review>) {
  const compact = raw.replaceAll(" ", "");
  const range = `${intelligence.period.start}~${intelligence.period.end}`;
  if (/\ucd5c\uadfc.*\uc990\uac70\uc6e0|\uc990\uac70\uc6e0.*\ubcf4\uc5ec/.test(compact)) {
    const entries = searchEnjoymentReviews(reviews).slice(0, 3);
    return entries.length ? `${range} \uae30\uc900 \uc990\uac70\uc6e0\ub2e4\uace0 \uae30\ub85d\ud55c \ub0a0: ${entries.map(entry => `${entry.date} ${entry.joy || entry.enjoyment}`).join(" / ")}` : `${range} \uae30\uc900\uc73c\ub85c \uc990\uac70\uc6c0 \uae30\ub85d\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.`;
  }
  if (/\ubb50\uc790\uafb8\ubbf8\ub904|\ub9ce\uc774\ubbf8\ub8e8|\ubbf8\ub8e8\uace0|\uc774\uc6d4/.test(compact)) {
    const carries = intelligence.todo.repeatedCarry.slice(0, 3);
    return carries.length ? `${range} \uae30\uc900 \ubc18\ubcf5 \uc774\uc6d4 Todo: ${carries.map(task => `${task.title} (${task.carryHistory?.filter(date => date >= intelligence.period.start && date <= intelligence.period.end).length ?? 0}\ud68c)`).join(", ")}` : `${range} \uae30\uc900\uc73c\ub85c ${MIN_PATTERN_OCCURRENCES}\ud68c \uc774\uc0c1 \ubc18\ubcf5 \uc774\uc6d4\ub41c Todo\ub294 \uc5c6\uc2b5\ub2c8\ub2e4.`;
  }
  if (/\ubb34\uc2a8\uc694\uc77c.*\ubc14\ube60|\uc5b8\uc81c.*\uc77c\uc815.*\uc801|\ubc14\uc05c\uc694\uc77c|\ube48\uc694\uc77c/.test(compact)) {
    const busy = intelligence.todo.weekday.filter(day => day.planned > 0).sort((a, b) => b.planned - a.planned)[0];
    const free = intelligence.planningSignals.freeWeekdays?.map(day => weekdayNames[day]);
    const facts = [busy ? `${range} Todo \uae30\uc900 \uac00\uc7a5 \ub9ce\uc740 \uc694\uc77c\uc740 ${weekdayNames[busy.weekday]} (${busy.planned}\uac1c)` : "Todo \uc694\uc77c \uae30\ub85d\uc774 \ucda9\ubd84\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.", free ? `\ub85c\ub4dc\ub41c Calendar \uae30\uac04\uc758 \ube48 \uc694\uc77c: ${free.join(", ") || "\uc5c6\uc74c"}` : "Calendar \ub85c\ub4dc \uae30\uac04\uc774 \ucda9\ubd84\ud558\uc9c0 \uc54a\uc544 \ube48 \uc694\uc77c\uc740 \ud310\ub2e8\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."];
    return facts.join("\n");
  }
  if (/\uacc4\ud68d.*\ub108\ubb34\ub9ce|\uc8fc\ub85c.*\uacc4\ud68d|\uacc4\ud68d.*\ub9ce/.test(compact)) {
    const gap = intelligence.planningSignals.planningGap;
    return gap ? `${range} \uae30\uc900 \ud558\ub8e8 \ud3c9\uade0 \uc608\uc815 Todo ${gap.plannedPerDay}\uac1c, \uc644\ub8cc ${gap.completedPerDay}\uac1c\uc785\ub2c8\ub2e4. \ucc28\uc774\ub294 ${gap.gap}\uac1c\uc785\ub2c8\ub2e4.` : `${range} \uae30\uc900\uc73c\ub85c \uacc4\ud68d\uacfc \uc644\ub8cc\ub97c \ube44\uad50\ud560 \uc77c\uc815 \uae30\ub85d\uc774 \ubd80\uc871\ud569\ub2c8\ub2e4.`;
  }
  if (/\uc5b4\ub5a4\ud504\ub85c\uc81d\ud2b8.*\ub9ce|\uba48\ucd94|\uc815\uccb4|\ud504\ub85c\uc81d\ud2b8/.test(compact)) {
    const observations = [intelligence.projects.mostActive ? `${range} Todo \uae30\ub85d\uc0c1 \uac00\uc7a5 \ud65c\ub3d9\uc774 \ub9ce\uc740 \ud504\ub85c\uc81d\ud2b8: ${intelligence.projects.mostActive}` : undefined, intelligence.projects.stalled.length ? `\ud65c\uc131 \uc0c1\ud0dc\uc774\uba70 \ucd5c\uadfc \ud65c\ub3d9 \uae30\ub85d\uc774 \uc5c6\ub294 \ud504\ub85c\uc81d\ud2b8: ${intelligence.projects.stalled.map(project => project.project.name).join(", ")}` : undefined].filter(Boolean);
    return observations.length ? observations.join("\n") : `${range} \uae30\uc900 \ud504\ub85c\uc81d\ud2b8 \ud65c\ub3d9 \uae30\ub85d\uc774 \ucda9\ubd84\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.`;
  }
  if (/\uc544\uce68\uae30\ub85d.*\uc798|\uc800\ub141\ub9ac\ubdf0.*\uc5bc\ub9c8/.test(compact)) {
    const observations = [`${range} \uae30\uc900 Morning Direction \uae30\ub85d ${intelligence.records.morningDirections}\uc77c, Evening Review \uae30\ub85d ${intelligence.records.eveningReviews}\uc77c`];
    if (intelligence.records.morningCompletion) observations.push(`Morning Direction \uc791\uc131\uc77c \uc644\ub8cc\uc728 ${intelligence.records.morningCompletion.written}%, \ubbf8\uc791\uc131\uc77c ${intelligence.records.morningCompletion.notWritten}% (\uc778\uacfc\uad00\uacc4 \ud310\ub2e8 \uc544\ub2d8)`);
    return observations.join("\n");
  }
  if (/\ud328\ud134|\uc0dd\ud65c\ud328\ud134|\uc778\uc0ac\uc774\ud2b8/.test(compact)) {
    const insights = intelligence.visibleInsights.slice(0, 3);
    return insights.length ? `${range} \uae30\uc900 \uad00\ucc30:\n${insights.map(insight => `- ${insight.summary} (${insight.evidence})`).join("\n")}` : `${range} \uae30\uc900\uc73c\ub85c \ubc18\ubcf5 \ud328\ud134\uc744 \ub9d0\ud560 \uc815\ub3c4\uc758 \uae30\ub85d\uc774 \uc544\uc9c1 \ucd94\ubd84\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.`;
  }
  return undefined;
}
