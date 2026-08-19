import type { Activity, Goal, Note, Project, RecurringTaskCompletion, RecurringTaskDefinition, TaskItem } from "./types";
import { getProjectDday } from "./projects";
import { getOccurrencesForRange } from "./recurrence";

export const PROJECT_STALLED_DAYS = 7;

export type ProjectHealth = "healthy" | "attention" | "atRisk";
export type ProjectActivity = { date: string; title: string; kind: "todo_completed" | "goal_updated" | "activity" | "note" };
export type ProjectNextAction = { title: string; source: "milestone" | "overdue" | "today" | "carry" | "upcoming" | "todo" | "manual"; taskId?: string; milestoneId?: string };

export type ProjectIntelligence = {
  project: Project;
  purpose: string;
  deadline?: string;
  connectedTodos: TaskItem[];
  completedTodos: TaskItem[];
  incompleteTodos: TaskItem[];
  overdueTodos: TaskItem[];
  linkedGoals: Goal[];
  connectedRoutines: RecurringTaskDefinition[];
  routineScheduled: number;
  routineCompleted: number;
  routineProgress?: number;
  calculatedProgress?: number;
  progressSource: "execution" | "routines" | "todos" | "milestones" | "none";
  recentActivity: ProjectActivity[];
  lastActivityAt?: string;
  nextAction?: ProjectNextAction;
  stalled: boolean;
  health: ProjectHealth;
  risks: string[];
};

const ymd = (value: Date | string) => typeof value === "string" ? value.slice(0, 10) : `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const hasDatePassed = (value: string | undefined, today: string) => Boolean(value && value.slice(0, 10) < today);

/** Computes project operations facts from existing Todo/Goal source-of-truth data. */
export function getProjectIntelligence(input: { project: Project; tasks: TaskItem[]; goals: Goal[]; activities?: Activity[]; notes?: Note[]; recurringTasks?: RecurringTaskDefinition[]; recurringTaskCompletions?: RecurringTaskCompletion[]; now?: Date }): ProjectIntelligence {
  const now = input.now ?? new Date();
  const today = ymd(now);
  const project = input.project;
  const connectedTodos = input.tasks.filter(task => task.projectId === project.id);
  const completedTodos = connectedTodos.filter(task => task.done);
  const incompleteTodos = connectedTodos.filter(task => !task.done);
  const overdueTodos = incompleteTodos.filter(task => hasDatePassed(task.dueDate || task.scheduledAt, today));
  const linkedGoals = input.goals.filter(goal => goal.projectId === project.id);
  const connectedRoutines = (input.recurringTasks ?? []).filter(task => task.projectId === project.id);
  const projectRangeReady = Boolean(project.startDate && project.dueDate && project.startDate <= project.dueDate);
  const scopedRoutines = projectRangeReady
    ? connectedRoutines.map(task => ({ ...task, isActive: true, startDate: project.startDate!, endDate: project.dueDate }))
    : [];
  const routineOccurrences = projectRangeReady
    ? getOccurrencesForRange(scopedRoutines, project.startDate!, project.dueDate!, input.recurringTaskCompletions ?? [])
    : [];
  const routineScheduled = routineOccurrences.length;
  const routineCompleted = routineOccurrences.filter(item => item.status === "done").length;
  const routineProgress = routineScheduled ? Math.round(routineCompleted / routineScheduled * 100) : undefined;
  const milestoneWeight = project.milestones.reduce((sum, milestone) => sum + Math.max(0, milestone.weight), 0);
  const milestoneDoneWeight = project.milestones.filter(milestone => milestone.done).reduce((sum, milestone) => sum + Math.max(0, milestone.weight), 0);
  const executionTotal = connectedTodos.length + routineScheduled;
  const executionCompleted = completedTodos.length + routineCompleted;
  const progressSource: ProjectIntelligence["progressSource"] =
    connectedTodos.length && routineScheduled ? "execution"
    : routineScheduled ? "routines"
    : connectedTodos.length ? "todos"
    : milestoneWeight ? "milestones"
    : "none";
  const calculatedProgress = progressSource === "execution"
    ? Math.round(executionCompleted / executionTotal * 100)
    : progressSource === "routines"
      ? routineProgress
      : progressSource === "todos"
        ? Math.round(completedTodos.length / connectedTodos.length * 100)
        : progressSource === "milestones"
          ? Math.round(milestoneDoneWeight / milestoneWeight * 100)
          : undefined;
  const recentActivity: ProjectActivity[] = [
    ...completedTodos.filter(task => task.doneAt).map(task => ({ date: task.doneAt!.slice(0, 10), title: task.title, kind: "todo_completed" as const })),
    ...linkedGoals.map(goal => ({ date: goal.updatedAt.slice(0, 10), title: goal.title, kind: "goal_updated" as const })),
    ...(input.activities ?? []).filter(activity => activity.projectId === project.id).map(activity => ({ date: activity.date.slice(0, 10), title: activity.title, kind: "activity" as const })),
    ...(input.notes ?? []).filter(note => note.projectId === project.id).map(note => ({ date: note.date.slice(0, 10), title: note.title, kind: "note" as const })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const lastActivityAt = recentActivity[0]?.date;
  const todayTodo = incompleteTodos.find(task => task.scheduledAt?.slice(0, 10) === today);
  const carryTodo = incompleteTodos.find(task => Boolean(task.carriedFrom || task.carryHistory?.length));
  const upcomingTodo = incompleteTodos.find(task => {
    const due = task.dueDate || task.scheduledAt?.slice(0, 10);
    const days = due ? getProjectDday(due, now) : undefined;
    return days !== undefined && days >= 0 && days <= 3;
  });
  const firstMilestone = project.milestones.find(milestone => !milestone.done);
  const firstTodo = incompleteTodos[0];
  const nextTask = overdueTodos[0] || todayTodo || carryTodo || upcomingTodo || firstTodo;
  const nextAction = firstMilestone
    ? { title: firstMilestone.title, milestoneId: firstMilestone.id, source: "milestone" as const }
    : nextTask
      ? { title: nextTask.title, taskId: nextTask.id, source: overdueTodos.includes(nextTask) ? "overdue" : todayTodo === nextTask ? "today" : carryTodo === nextTask ? "carry" : upcomingTodo === nextTask ? "upcoming" : "todo" } as ProjectNextAction
      : project.next.trim() ? { title: project.next.trim(), source: "manual" as const } : undefined;
  const stalled = project.status === "active" && Boolean(lastActivityAt) && Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.parse(`${lastActivityAt}T00:00:00Z`)) / 86_400_000) >= PROJECT_STALLED_DAYS;
  const deadlineDays = getProjectDday(project.dueDate, now);
  const repeatedCarries = incompleteTodos.some(task => (task.carryHistory?.length ?? 0) >= 3);
  const risks: string[] = [];
  if (deadlineDays !== undefined && deadlineDays < 0) risks.push("마감일이 지났습니다.");
  if (overdueTodos.length) risks.push(`마감이 지난 할 일 ${overdueTodos.length}개`);
  if (deadlineDays !== undefined && deadlineDays >= 0 && deadlineDays <= 3 && incompleteTodos.length) risks.push("마감일이 임박했습니다.");
  if (repeatedCarries) risks.push("반복 이월된 할 일이 있습니다.");
  if (stalled) risks.push(`${PROJECT_STALLED_DAYS}일 이상 최근 활동이 없습니다.`);
  const health: ProjectHealth = risks.some(risk => risk.includes("지났") || risk.includes("마감이 지난")) ? "atRisk" : risks.length ? "attention" : "healthy";
  return { project, purpose: project.goal.trim(), deadline: project.dueDate, connectedTodos, completedTodos, incompleteTodos, overdueTodos, linkedGoals, connectedRoutines, routineScheduled, routineCompleted, routineProgress, calculatedProgress, progressSource, recentActivity, lastActivityAt, nextAction, stalled, health, risks };
}
