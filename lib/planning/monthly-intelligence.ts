import { getMonthRange, getWeekRange } from "./periods";
import { getProjectIntelligence, type ProjectIntelligence } from "./project-intelligence";
import type { Activity, Goal, Note, Plan, Project, RecurringTaskCompletion, RecurringTaskDefinition, Review, TaskItem } from "./types";
import { getRoutineIntelligence, type RoutineIntelligence } from "./routine-intelligence";

export type MonthlyEvent = { id: string; title: string; start: string; end?: string; calendarId?: string };
export type MonthlyReview = NonNullable<Plan["monthlyReview"]>;
export type MonthlySummary = {
  month: string; range: { start: string; end: string };
  monthlyGoals: Goal[]; weeklyGoals: Goal[]; weeklyGoalsByMonthlyGoal: Record<string, Goal[]>;
  todo: { planned: TaskItem[]; completed: TaskItem[]; incomplete: TaskItem[]; completionRate: number; carryCount: number; overdue: TaskItem[]; repeatedlyDeferred: TaskItem[]; nextMonthCandidates: TaskItem[] };
  calendar: { count: number; minutes: number; busiestDay?: string; busiestWeek?: string; conflicts: number; quietDays: string[] };
  projects: Array<{ intelligence: ProjectIntelligence; todos: TaskItem[]; completed: number; carries: number; activityDays: number }>;
  mostActiveProject?: string; stalledProjects: ProjectIntelligence[];
  weeklyFlow: Array<{ start: string; end: string; todoTotal: number; todoCompleted: number; completionRate: number; calendarCount: number }>;
  routine: RoutineIntelligence;
  records: { morningDirections: number; eveningReviews: number; weeklyReviews: number; monthlyReview?: MonthlyReview };
  briefing: string;
};

const inRange = (value: string | undefined, start: string, end: string) => Boolean(value && value.slice(0, 10) >= start && value.slice(0, 10) <= end);
const dates = (start: string, end: string) => { const out: string[] = []; const d = new Date(`${start}T12:00:00`); while (d.toISOString().slice(0, 10) <= end) { out.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); } return out; };
const eventMinutes = (event: MonthlyEvent) => Math.max(0, ((new Date(event.end ?? event.start).getTime() - new Date(event.start).getTime()) / 60_000) || 0);

/** Reusable, source-of-truth monthly operational summary. It tolerates missing Calendar data. */
export function getMonthlySummary(input: { month: string; now?: Date; goals: Goal[]; plans: Plan[]; tasks: TaskItem[]; events?: MonthlyEvent[]; projects: Project[]; reviews: Record<string, Review>; activities?: Activity[]; notes?: Note[]; recurringTasks?: RecurringTaskDefinition[]; recurringTaskCompletions?: RecurringTaskCompletion[] }): MonthlySummary {
  const range = getMonthRange(`${input.month}-01`);
  const planned = input.tasks.filter(task => inRange(task.scheduledAt, range.start, range.end) || inRange(task.originalScheduledDate, range.start, range.end) || (task.carryHistory ?? []).some(date => inRange(date, range.start, range.end)));
  const completed = input.tasks.filter(task => task.done && inRange(task.doneAt, range.start, range.end));
  const allTaskIds = new Set([...planned, ...completed].map(task => task.id));
  const monthlyTasks = input.tasks.filter(task => allTaskIds.has(task.id));
  const incomplete = monthlyTasks.filter(task => !task.doneAt || task.doneAt.slice(0, 10) > range.end);
  const now = input.now ?? new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const overdueCutoff = today < range.start ? today : today > range.end ? range.end : today;
  const overdue = incomplete.filter(task => Boolean(task.dueDate && task.dueDate.slice(0, 10) < overdueCutoff));
  const repeatedlyDeferred = incomplete.filter(task => (task.carryHistory?.filter(date => inRange(date, range.start, range.end)).length ?? 0) >= 2 || (task.carryHistory?.length ?? 0) >= 3);
  const nextMonthCandidates = incomplete.filter(task => (task.scheduledAt && task.scheduledAt.slice(0, 10) <= range.end) || (task.originalScheduledDate && inRange(task.originalScheduledDate, range.start, range.end)));
  const monthlyGoals = input.goals.filter(goal => goal.horizon === "MONTH" && goal.periodStart.slice(0, 7) === input.month);
  const weeklyGoals = input.goals.filter(goal => goal.horizon === "WEEK" && (inRange(goal.periodStart, range.start, range.end) || inRange(goal.periodEnd, range.start, range.end)));
  const weeklyGoalsByMonthlyGoal = Object.fromEntries(monthlyGoals.map(goal => [goal.id, weeklyGoals.filter(weekly => weekly.parentGoalId === goal.id)]));
  const events = (input.events ?? []).filter(event => inRange(event.start, range.start, range.end));
  const dayCount = new Map<string, number>(); const weekCount = new Map<string, number>();
  events.forEach(event => { const day = event.start.slice(0, 10); dayCount.set(day, (dayCount.get(day) ?? 0) + 1); const week = getWeekRange(day).start; weekCount.set(week, (weekCount.get(week) ?? 0) + 1); });
  const sortedEvents = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const conflicts = sortedEvents.reduce((state, event) => { const start = new Date(event.start).getTime(); const end = new Date(event.end ?? event.start).getTime(); return { count: state.count + (state.latestEnd > start ? 1 : 0), latestEnd: Math.max(state.latestEnd, end) }; }, { count: 0, latestEnd: Number.NEGATIVE_INFINITY }).count;
  const projectRows = input.projects.map(project => {
    const todos = monthlyTasks.filter(task => task.projectId === project.id);
    const intelligence = getProjectIntelligence({ project, tasks: input.tasks, goals: input.goals, activities: input.activities, notes: input.notes, now: input.now });
    const activityDays = new Set([...todos.filter(task => task.doneAt && inRange(task.doneAt, range.start, range.end)).map(task => task.doneAt!.slice(0, 10)), ...intelligence.recentActivity.filter(activity => inRange(activity.date, range.start, range.end)).map(activity => activity.date)]).size;
    return { intelligence, todos, completed: todos.filter(task => task.done && inRange(task.doneAt, range.start, range.end)).length, carries: todos.reduce((sum, task) => sum + (task.carryHistory?.filter(date => inRange(date, range.start, range.end)).length ?? 0), 0), activityDays };
  }).filter(row => row.todos.length || row.activityDays);
  const flowStarts: string[] = []; for (const day of dates(range.start, range.end)) { const start = getWeekRange(day).start; if (!flowStarts.includes(start)) flowStarts.push(start); }
  const weeklyFlow = flowStarts.map(start => { const week = getWeekRange(start); const tasks = monthlyTasks.filter(task => inRange(task.scheduledAt, week.start, week.end) || inRange(task.doneAt, week.start, week.end)); const done = tasks.filter(task => task.done && inRange(task.doneAt, range.start, range.end)).length; return { start: week.start, end: week.end, todoTotal: tasks.length, todoCompleted: done, completionRate: tasks.length ? Math.round(done / tasks.length * 100) : 0, calendarCount: events.filter(event => inRange(event.start, week.start, week.end)).length }; });
  const reviewDates = Object.keys(input.reviews).filter(date => inRange(date, range.start, range.end));
  const weeklyReviews = input.plans.filter(plan => plan.horizon === "WEEK" && Boolean(plan.weeklyReview) && (inRange(plan.periodStart, range.start, range.end) || inRange(plan.periodEnd, range.start, range.end))).length;
  const monthlyPlan = input.plans.find(plan => plan.horizon === "MONTH" && plan.periodStart.slice(0, 7) === input.month);
  const completionRate = monthlyTasks.length ? Math.round(completed.length / monthlyTasks.length * 100) : 0;
  const mostActive = [...projectRows].sort((a, b) => (b.completed + b.todos.length + b.activityDays) - (a.completed + a.todos.length + a.activityDays))[0];
  const stalledProjects = input.projects.map(project => getProjectIntelligence({ project, tasks: input.tasks, goals: input.goals, activities: input.activities, notes: input.notes, now: input.now })).filter(info => info.stalled);
  const completedGoals = monthlyGoals.filter(goal => goal.status === "done").length;
  const routine = getRoutineIntelligence({ start: range.start, end: range.end, routines: input.recurringTasks, completions: input.recurringTaskCompletions, now });
  const briefing = `이번 달 할 일은 ${monthlyTasks.length}개 중 ${completed.length}개를 완료했습니다.${monthlyGoals.length ? ` 월간 목표는 ${monthlyGoals.length}개 중 ${completedGoals}개 완료입니다.` : " 월간 목표는 없습니다."}${mostActive ? ` ${mostActive.intelligence.project.name}에서 가장 많은 활동이 있었습니다.` : ""}${repeatedlyDeferred.length ? ` 반복해서 미뤄진 할 일은 ${repeatedlyDeferred.length}개입니다.` : ""}${stalledProjects.length ? ` 현재 멈춘 활성 프로젝트는 ${stalledProjects.length}개입니다.` : ""}${routine.scheduled ? ` 루틴은 ${routine.scheduled}회 중 ${routine.completed}회 완료(${routine.completionRate}%)했습니다.` : ""}`;
  return { month: input.month, range, monthlyGoals, weeklyGoals, weeklyGoalsByMonthlyGoal, todo: { planned: monthlyTasks, completed, incomplete, completionRate, carryCount: monthlyTasks.reduce((sum, task) => sum + (task.carryHistory?.filter(date => inRange(date, range.start, range.end)).length ?? 0), 0), overdue, repeatedlyDeferred, nextMonthCandidates }, calendar: { count: events.length, minutes: events.reduce((sum, event) => sum + eventMinutes(event), 0), busiestDay: [...dayCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0], busiestWeek: [...weekCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0], conflicts, quietDays: dates(range.start, range.end).filter(day => !dayCount.has(day)) }, projects: projectRows, mostActiveProject: mostActive?.intelligence.project.name, stalledProjects, weeklyFlow, routine, records: { morningDirections: input.goals.filter(goal => goal.horizon === "DAY" && inRange(goal.periodStart, range.start, range.end)).length, eveningReviews: reviewDates.length, weeklyReviews, monthlyReview: monthlyPlan?.monthlyReview }, briefing };
}
