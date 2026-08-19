import type { DailyContinuity } from "./daily-continuity";
import type { DailyRecord } from "./daily-record";
import type { MorningBriefing, MorningBriefingEvent } from "./morning-briefing";
import type { PersonalIntelligence } from "./personal-intelligence";
import type { ProactiveReminder } from "./proactive-reminders";
import type { ProjectIntelligence } from "./project-intelligence";
import type { Goal, Project, TaskItem } from "./types";

export const MORNING_END_HOUR = 12;
export const EVENING_START_HOUR = 19;

export type OperatingPhase = "MORNING" | "ACTIVE_DAY" | "EVENING" | "CLOSED";
export type OperatingCalendarState = "AVAILABLE" | "UNKNOWN" | "EMPTY";
export type OperatingReplanningSignal = { needed: boolean; reasons: string[]; affectedTodoIds: string[] };

export type OperatingContext = {
  date: string;
  now: Date;
  phase: OperatingPhase;
  morning: MorningBriefing["direction"];
  calendar: {
    state: OperatingCalendarState;
    events: MorningBriefingEvent[];
    currentEvent?: MorningBriefingEvent;
    nextEvent?: MorningBriefingEvent;
  };
  todos: {
    all: TaskItem[];
    total: number;
    completed: number;
    incomplete: TaskItem[];
    progress: number;
    overdue: TaskItem[];
    carry: TaskItem[];
    urgent: TaskItem[];
    planned: TaskItem[];
    tomorrow: TaskItem[];
  };
  projects: ProjectIntelligence[];
  activeProject?: ProjectIntelligence;
  goals: { weekly: Goal[]; monthly: Goal[] };
  planningSignals: PersonalIntelligence["planningSignals"];
  primaryReminder?: ProactiveReminder;
  reminders: ProactiveReminder[];
  dailyRecord: DailyRecord;
  continuity: DailyContinuity;
  replanning: OperatingReplanningSignal;
};

type Input = {
  date: string;
  now: Date;
  calendarAvailable: boolean;
  events: MorningBriefingEvent[];
  tasks: TaskItem[];
  projects: Project[];
  goals: Goal[];
  morningBriefing: MorningBriefing;
  dailyRecord: DailyRecord;
  continuity: DailyContinuity;
  projectIntelligence: ProjectIntelligence[];
  personalIntelligence: PersonalIntelligence;
  reminders: ProactiveReminder[];
  dismissedReminderIds?: string[];
};

const asTime = (value: string) => new Date(value).getTime();
const datePart = (value: string | undefined) => value?.slice(0, 10);
const overlaps = (left: MorningBriefingEvent, right: MorningBriefingEvent) =>
  asTime(left.start) < asTime(right.end || right.start) && asTime(right.start) < asTime(left.end || left.start);

export function getOperatingPhase(input: { now: Date; directionComplete: boolean; reviewComplete: boolean }): OperatingPhase {
  if (input.reviewComplete) return "CLOSED";
  if (input.now.getHours() >= EVENING_START_HOUR) return "EVENING";
  if (input.now.getHours() < MORNING_END_HOUR && !input.directionComplete) return "MORNING";
  return "ACTIVE_DAY";
}

/** The single derived source shared by the Home summary and Assistant operating answers. */
export function getOperatingContext(input: Input): OperatingContext {
  const events = [...input.events].sort((a, b) => a.start.localeCompare(b.start));
  const today = input.tasks.filter(task => datePart(task.scheduledAt) === input.date || (!datePart(task.scheduledAt) && task.doneAt === input.date));
  const incomplete = today.filter(task => !task.done);
  const overdue = input.tasks.filter(task => !task.done && Boolean(datePart(task.dueDate || task.scheduledAt) && datePart(task.dueDate || task.scheduledAt)! < input.date));
  const carry = today.filter(task => Boolean(task.carriedFrom || task.carryHistory?.length));
  const planned = today.filter(task => Boolean(task.calendarEventId));
  const nextDate = tomorrow(input.now);
  const tomorrowTodos = input.tasks.filter(task => !task.done && datePart(task.scheduledAt) === nextDate);
  const now = input.now.getTime();
  const currentEvent = events.find(event => asTime(event.start) <= now && asTime(event.end || event.start) >= now);
  const nextEvent = events.find(event => asTime(event.start) > now);
  const urgent = [...overdue, ...incomplete.filter(task => task.dueDate === input.date)].filter((task, index, all) => all.findIndex(item => item.id === task.id) === index);
  const plannedEventIds = new Set(planned.map(task => task.calendarEventId).filter(Boolean));
  const plannedEvents = events.filter(event => plannedEventIds.has(event.id));
  const reasons: string[] = [];
  const affectedTodoIds = new Set<string>();
  for (const block of plannedEvents) {
    const conflict = events.find(event => event.id !== block.id && !plannedEventIds.has(event.id) && overlaps(block, event));
    if (conflict) {
      reasons.push(`${block.title} 시간 블록이 ${conflict.title} 일정과 겹칩니다.`);
      planned.filter(task => task.calendarEventId === block.id).forEach(task => affectedTodoIds.add(task.id));
    }
  }
  if (!reasons.length && incomplete.length > 5 && input.personalIntelligence.planningSignals.typicalTodoCapacity?.median && incomplete.length > input.personalIntelligence.planningSignals.typicalTodoCapacity.median * 1.5) {
    reasons.push("오늘의 미완료 Todo가 최근 실행 가능 범위를 넘습니다.");
  }
  const visibleReminders = input.reminders.filter(reminder => !input.dismissedReminderIds?.includes(reminder.id));
  const weekly = input.goals.filter(goal => goal.status === "active" && goal.horizon === "WEEK" && goal.periodStart <= input.date && goal.periodEnd >= input.date);
  const monthly = input.goals.filter(goal => goal.status === "active" && goal.horizon === "MONTH" && goal.periodStart <= input.date && goal.periodEnd >= input.date);
  const activeProjects = input.projectIntelligence.filter(info => info.project.status === "active");
  return {
    date: input.date,
    now: input.now,
    phase: getOperatingPhase({ now: input.now, directionComplete: input.morningBriefing.direction.isComplete, reviewComplete: Boolean(input.dailyRecord.eveningReview) }),
    morning: input.morningBriefing.direction,
    calendar: { state: input.calendarAvailable ? (events.length ? "AVAILABLE" : "EMPTY") : "UNKNOWN", events, currentEvent, nextEvent },
    todos: { all: today, total: today.length, completed: today.filter(task => task.done).length, incomplete, progress: today.length ? Math.round(today.filter(task => task.done).length / today.length * 100) : 0, overdue, carry, urgent, planned, tomorrow: tomorrowTodos },
    projects: activeProjects,
    activeProject: activeProjects.find(info => today.some(task => task.projectId === info.project.id)) ?? activeProjects[0],
    goals: { weekly, monthly },
    planningSignals: input.personalIntelligence.planningSignals,
    primaryReminder: visibleReminders[0],
    reminders: visibleReminders,
    dailyRecord: input.dailyRecord,
    continuity: input.continuity,
    replanning: { needed: reasons.length > 0, reasons, affectedTodoIds: [...affectedTodoIds] },
  };
}

const clock = (value: string) => new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
const tomorrow = (now: Date) => { const value = new Date(now); value.setDate(value.getDate() + 1); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; };

/** Read-only operating intents. Mutating Todo/Calendar actions remain in the existing action and planning flows. */
export function answerOperatingQuestion(raw: string, context: OperatingContext): string | undefined {
  const compact = raw.replaceAll(" ", "");
  const calendarUnknown = context.calendar.state === "UNKNOWN";
  if (/오늘상황|현재상황|오늘어때/.test(compact)) {
    return `오늘 Todo는 ${context.todos.completed}/${context.todos.total} 완료(${context.todos.progress}%)입니다. ${calendarUnknown ? "현재 캘린더를 확인할 수 없습니다." : context.calendar.nextEvent ? `다음 일정은 ${clock(context.calendar.nextEvent.start)} ${context.calendar.nextEvent.title}입니다.` : "남은 캘린더 일정은 없습니다."}${context.todos.overdue.length ? ` 마감이 지난 Todo ${context.todos.overdue.length}개가 있습니다.` : ""}`;
  }
  if (/지금.*뭐|지금뭘|다음뭐|다음일정/.test(compact)) {
    if (context.calendar.currentEvent) return `현재 ${context.calendar.currentEvent.title} 일정 진행 중입니다. ${clock(context.calendar.currentEvent.end)}에 끝납니다.`;
    if (context.calendar.nextEvent) return `다음 일정은 ${clock(context.calendar.nextEvent.start)} ${context.calendar.nextEvent.title}입니다.${context.todos.urgent[0] ? ` 그 전에는 ${context.todos.urgent[0].title}을 우선 확인하세요.` : ""}`;
    if (context.todos.urgent[0]) return `일정 사이 우선순위는 ${context.todos.urgent[0].title}입니다.`;
    if (context.todos.incomplete[0]) return `다음 할 일은 ${context.todos.incomplete[0].title}입니다.`;
    return context.activeProject?.nextAction ? `오늘의 다음 프로젝트 행동은 ${context.activeProject.nextAction.title}입니다.` : "현재 처리할 오늘 Todo나 다음 일정이 없습니다.";
  }
  if (/오늘.*얼마나남|오늘남은|진행률/.test(compact)) return `오늘 Todo ${context.todos.total}개 중 ${context.todos.completed}개를 완료했습니다(${context.todos.progress}%). 미완료는 ${context.todos.incomplete.length}개입니다.`;
  if (/놓친|미룬|체크/.test(compact)) return context.todos.overdue.length || context.todos.carry.length ? `확인이 필요한 항목: ${[...context.todos.overdue, ...context.todos.carry].filter((task, index, all) => all.findIndex(item => item.id === task.id) === index).map(task => task.title).join(" · ")}` : "현재 overdue 또는 carry Todo는 없습니다.";
  if (/계획.*바꿔|리플랜|다시배치/.test(compact)) return context.replanning.needed ? `계획 영향 신호가 있습니다: ${context.replanning.reasons.join(" ")} 영향을 받는 부분만 다시 배치할 수 있습니다. 원하시면 오늘 계획을 다시 제안할게요.` : "현재 확정된 시간 블록과 새 일정의 충돌은 감지되지 않았습니다. 지금은 재계획이 필요하지 않습니다.";
  if (/너무바빠|바빠/.test(compact)) return `오늘 미완료 Todo는 ${context.todos.incomplete.length}개이고${calendarUnknown ? " 캘린더 상태는 확인할 수 없습니다." : ` 남은 일정은 ${context.calendar.events.filter(event => asTime(event.end || event.start) > context.now.getTime()).length}개입니다.`}${context.replanning.needed ? " 일정 충돌도 있어, 영향을 받는 부분만 다시 배치하는 편이 좋습니다." : " 필요하면 우선순위 중심으로 오늘 계획을 다시 제안할 수 있습니다."}`;
  if (/오늘마무리|하루마무리|저녁리뷰/.test(compact)) return context.dailyRecord.eveningReview ? "오늘 Evening Review가 이미 저장되어 있습니다." : `오늘 리뷰를 시작할 수 있습니다. Todo ${context.dailyRecord.todoSummary.completed}/${context.dailyRecord.todoSummary.total} 완료, 연결된 프로젝트 ${context.dailyRecord.projectSummary.length}개입니다.`;
  if (/내일.*뭐|내일일정/.test(compact)) {
    const date = tomorrow(context.now); const tasks = context.todos.tomorrow;
    return `내일(${date}) 예정 Todo는 ${tasks.length ? tasks.map(task => task.title).join(" · ") : "없습니다"}. 내일 일정을 확정하거나 이동하지는 않았습니다.`;
  }
  if (/즐길|기쁨/.test(compact)) return context.dailyRecord.morningDirection.enjoyment ? `오늘 즐기기로 정한 것은 ${context.dailyRecord.morningDirection.enjoyment}입니다.` : "오늘의 즐길 것은 아직 기록되지 않았습니다.";
  return undefined;
}
