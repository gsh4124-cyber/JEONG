import { getMonthRange, getWeekRange } from "./periods";
import { getOccurrencesForDate, getOccurrencesForRange, type RecurringTaskOccurrence } from "./recurrence";
import type { ContextFilterValue, Goal, LocalState, Plan, Project, TaskItem } from "./types";

export type HomePeriod = "day" | "week" | "month";
export type HomeCalendarEvent = { id: string; title: string; start: string; end?: string; calendarId?: string; location?: string };
export type HomeProgress = { total: number; completed: number; remaining: number };
export type HomeDirection = { label: string; value: string; contextId?: string };
export type HomeSummary = {
  period: HomePeriod;
  start: string;
  end: string;
  directions: HomeDirection[];
  goals: Goal[];
  events: HomeCalendarEvent[];
  todos: TaskItem[];
  recurring: RecurringTaskOccurrence[];
  projects: Array<Project & { progress: number }>;
  goalProgress: HomeProgress;
  todoProgress: HomeProgress;
  recurringProgress: HomeProgress;
  daily?: { goal: string; reason: string; enjoyment: string; linkedWeeklyGoal?: Goal };
};

type Input = { state: LocalState; events: HomeCalendarEvent[]; date: string; context: ContextFilterValue };
const key = (value: string) => value.slice(0, 10);
const contextId = (state: LocalState, filter: ContextFilterValue) => filter === "ALL" ? undefined : state.contexts.find(item => item.key === filter)?.id;
const matchesContext = (value: { contextId?: string }, id?: string) => !id || value.contextId === id;
const eventContext = (state: LocalState, event: HomeCalendarEvent) => state.calendarContextMappings.find(item => item.calendarId === event.calendarId)?.contextId;
const inRange = (value: string, start: string, end: string) => key(value) >= start && key(value) <= end;
const eventInRange = (event: HomeCalendarEvent, start: string, end: string) => key(event.start) <= end && key(event.end ?? event.start) >= start;
const progress = (total: number, completed: number): HomeProgress => ({ total, completed, remaining: Math.max(0, total - completed) });
const projectProgress = (project: Project) => {
  const total = project.milestones.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (!total) return project.status === "done" ? 100 : 0;
  return Math.round(project.milestones.filter(item => item.done).reduce((sum, item) => sum + Math.max(0, item.weight), 0) / total * 100);
};
const plansFor = (state: LocalState, horizon: Plan["horizon"], start: string, id?: string) => {
  const candidates = state.plans.filter(plan => plan.horizon === horizon && plan.periodStart === start && matchesContext(plan, id));
  const ordered = id ? candidates : [...candidates].sort((a, b) => Number(!!a.contextId) - Number(!!b.contextId));
  return ordered.filter(plan => plan.direction.trim()).map(plan => ({
    label: horizon === "WEEK" ? "이번 주 방향" : "이번 달 방향",
    value: plan.direction,
    contextId: plan.contextId,
  }));
};
function build(input: Input, period: HomePeriod, start: string, end: string): HomeSummary {
  const id = contextId(input.state, input.context);
  const horizon = period === "month" ? "MONTH" : "WEEK";
  const goalHorizon = period === "day" ? "DAY" : horizon;
  const goals = input.state.goals.filter(goal => goal.horizon === goalHorizon && inRange(goal.periodStart, start, end) && matchesContext(goal, id));
  const events = input.events.filter(event => eventInRange(event, start, end) && (!id || eventContext(input.state, event) === id));
  const todos = input.state.tasks.filter(task => matchesContext(task, id) && (inRange(task.scheduledAt, start, end) || (period === "day" && task.bucket === "today")));
  const recurring = (period === "day"
    ? getOccurrencesForDate(input.state.recurringTasks, start, input.state.recurringTaskCompletions)
    : getOccurrencesForRange(input.state.recurringTasks, start, end, input.state.recurringTaskCompletions))
    .filter(item => matchesContext(item.task, id));
  const projects = input.state.projects.filter(project => project.status !== "done" && matchesContext(project, id)).map(project => ({ ...project, progress: projectProgress(project) }));
  const directions = period === "day"
    ? [...plansFor(input.state, "WEEK", getWeekRange(start).start, id), ...plansFor(input.state, "MONTH", getMonthRange(start).start, id)]
    : plansFor(input.state, horizon, start, id);
  const linkedWeeklyGoal = input.state.parentWeeklyGoalId ? input.state.goals.find(goal => goal.id === input.state.parentWeeklyGoalId) : undefined;
  return {
    period, start, end, directions, goals, events, todos, recurring, projects,
    goalProgress: progress(goals.length, goals.filter(goal => goal.status === "done").length),
    todoProgress: progress(todos.length, todos.filter(task => task.done).length),
    recurringProgress: progress(recurring.length, recurring.filter(item => item.status === "done").length),
    daily: period === "day" ? { goal: input.state.goal, reason: input.state.reason, enjoyment: input.state.enjoyment, linkedWeeklyGoal } : undefined,
  };
}
export const getDailyHomeSummary = (input: Input) => build(input, "day", key(input.date), key(input.date));
export const getWeeklyHomeSummary = (input: Input) => { const range = getWeekRange(input.date); return build(input, "week", range.start, range.end); };
export const getMonthlyHomeSummary = (input: Input) => { const range = getMonthRange(input.date); return build(input, "month", range.start, range.end); };
