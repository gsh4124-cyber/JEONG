import type {
  Context,
  ContextFilterValue,
  RecurringTaskCompletion,
  RecurringTaskDefinition,
  RecurringTaskStatus,
} from "./types";

export type RecurringTaskOccurrence = {
  task: RecurringTaskDefinition;
  occurrenceDate: string;
  status?: RecurringTaskStatus;
  completion?: RecurringTaskCompletion;
};

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const startOfWeek = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - result.getDay());
  return result;
};

export function occursOnDate(task: RecurringTaskDefinition, dateValue: string): boolean {
  if (!task.isActive) return false;
  const dateKey = dateValue.slice(0, 10);
  if (dateKey < task.startDate.slice(0, 10)) return false;
  if (task.endDate && dateKey > task.endDate.slice(0, 10)) return false;

  const date = parseLocalDate(dateKey);
  if (Number.isNaN(date.getTime())) return false;

  if (task.recurrence.type === "DAILY") return true;
  if (task.recurrence.type === "WEEKDAYS") return date.getDay() >= 1 && date.getDay() <= 5;
  if (task.recurrence.type === "MONTHLY") return date.getDate() === task.recurrence.dayOfMonth;
  if (task.recurrence.type === "WEEKLY_BLOCKS") return task.recurrence.blocks.some((block) => {
    const day=date.getDay();
    return block.startDay<=block.endDay ? day>=block.startDay&&day<=block.endDay : day>=block.startDay||day<=block.endDay;
  });

  if (!task.recurrence.weekdays.includes(date.getDay())) return false;
  const interval = Math.max(1, task.recurrence.interval ?? 1);
  const startWeek = startOfWeek(parseLocalDate(task.startDate));
  const targetWeek = startOfWeek(date);
  const weekDistance = Math.floor((targetWeek.getTime() - startWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return weekDistance >= 0 && weekDistance % interval === 0;
}

export function getOccurrenceStatus(
  task: RecurringTaskDefinition,
  occurrenceDate: string,
  completions: RecurringTaskCompletion[],
) {
  return completions.find(
    (completion) => completion.recurringTaskId === task.id && completion.occurrenceDate === occurrenceDate.slice(0, 10),
  );
}

export function getOccurrencesForDate(
  tasks: RecurringTaskDefinition[],
  date: string,
  completions: RecurringTaskCompletion[] = [],
): RecurringTaskOccurrence[] {
  const occurrenceDate = date.slice(0, 10);
  return tasks.filter((task) => occursOnDate(task, occurrenceDate)).filter((task)=>{
    if(task.recurrence.type!=="WEEKLY_BLOCKS")return true;
    const date=parseLocalDate(occurrenceDate); const day=date.getDay();
    const block=task.recurrence.blocks.find(block=>block.startDay<=block.endDay?day>=block.startDay&&day<=block.endDay:day>=block.startDay||day<=block.endDay);
    if(!block)return false;
    const monday=new Date(date); monday.setDate(date.getDate()-((day+6)%7));
    const dates:number[]=[]; for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const wd=d.getDay();if(block.startDay<=block.endDay?wd>=block.startDay&&wd<=block.endDay:wd>=block.startDay||wd<=block.endDay)dates.push(d.getTime())}
    const first=formatLocalDate(new Date(Math.min(...dates))), last=formatLocalDate(new Date(Math.max(...dates)));
    const done=completions.filter(c=>c.recurringTaskId===task.id&&c.status==="done"&&c.occurrenceDate>=first&&c.occurrenceDate<=last);
    return done.some(c=>c.occurrenceDate===occurrenceDate)||done.length<Math.max(1,block.target);
  }).map((task) => {
    const completion = getOccurrenceStatus(task, occurrenceDate, completions);
    return { task, occurrenceDate, status: completion?.status, completion };
  });
}

export function getOccurrencesForRange(
  tasks: RecurringTaskDefinition[],
  start: string,
  end: string,
  completions: RecurringTaskCompletion[] = [],
): RecurringTaskOccurrence[] {
  const results: RecurringTaskOccurrence[] = [];
  const cursor = parseLocalDate(start);
  const last = parseLocalDate(end);
  while (cursor.getTime() <= last.getTime()) {
    results.push(...getOccurrencesForDate(tasks, formatLocalDate(cursor), completions));
    cursor.setDate(cursor.getDate() + 1);
  }
  return results;
}

export function getRecurringTasksForDate({
  tasks,
  date,
  completions = [],
  contexts,
  context = "ALL",
}: {
  tasks: RecurringTaskDefinition[];
  date: string;
  completions?: RecurringTaskCompletion[];
  contexts: Context[];
  context?: ContextFilterValue;
}) {
  const contextId = context === "ALL" ? undefined : contexts.find((item) => item.key === context)?.id;
  return getOccurrencesForDate(tasks, date, completions).filter(
    (occurrence) => !contextId || occurrence.task.contextId === contextId,
  );
}

const googleWeekday = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function recurrenceToGoogleRrule(task: RecurringTaskDefinition): string {
  let rule = "RRULE:";
  if (task.recurrence.type === "DAILY") rule += "FREQ=DAILY";
  else if (task.recurrence.type === "WEEKDAYS") rule += "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  else if (task.recurrence.type === "MONTHLY") rule += `FREQ=MONTHLY;BYMONTHDAY=${task.recurrence.dayOfMonth}`;
  else if (task.recurrence.type === "WEEKLY_BLOCKS") rule += "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU";
  else {
    const days = task.recurrence.weekdays.map((day) => googleWeekday[day]).join(",");
    rule += `FREQ=WEEKLY;INTERVAL=${Math.max(1, task.recurrence.interval ?? 1)};BYDAY=${days}`;
  }
  if (task.endDate) rule += `;UNTIL=${task.endDate.replaceAll("-", "")}T235959Z`;
  return rule;
}

export function describeRecurrence(task: RecurringTaskDefinition): string {
  if (task.recurrence.type === "DAILY") return "매일";
  if (task.recurrence.type === "WEEKDAYS") return "평일";
  if (task.recurrence.type === "MONTHLY") return `매월 ${task.recurrence.dayOfMonth}일`;
  if (task.recurrence.type === "WEEKLY_BLOCKS") return task.recurrence.blocks.map(block=>`${["일","월","화","수","목","금","토"][block.startDay]}~${["일","월","화","수","목","금","토"][block.endDay]} ${block.target}회`).join(" · ");
  const orderedDays = [...task.recurrence.weekdays].sort((a, b) => a - b);
  if ((task.recurrence.interval ?? 1) === 1 && orderedDays.length === 2 && orderedDays[0] === 0 && orderedDays[1] === 6) return "주말";
  const days = orderedDays.map((day) => ["일", "월", "화", "수", "목", "금", "토"][day]).join("·");
  return task.recurrence.interval === 2 ? `격주 ${days}` : `매주 ${days}`;
}
