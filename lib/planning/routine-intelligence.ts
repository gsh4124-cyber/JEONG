import { getOccurrencesForRange } from "./recurrence";
import type { RecurringTaskCompletion, RecurringTaskDefinition } from "./types";

export type RoutineIntelligence = {
  scheduled: number;
  completed: number;
  skipped: number;
  pending: number;
  completionRate: number;
  byRoutine: Array<{ id: string; title: string; scheduled: number; completed: number; skipped: number; pending: number; completionRate: number }>;
  struggling: Array<{ id: string; title: string; scheduled: number; completed: number; completionRate: number }>;
};

export function getRoutineIntelligence(input: {
  start: string;
  end: string;
  routines?: RecurringTaskDefinition[];
  completions?: RecurringTaskCompletion[];
  now?: Date;
}): RoutineIntelligence {
  const routines = input.routines ?? [];
  const completions = input.completions ?? [];
  const todayDate = input.now ?? new Date();
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth()+1).padStart(2,"0")}-${String(todayDate.getDate()).padStart(2,"0")}`;
  // Future occurrences are plans, not failures. Only elapsed/today occurrences count toward execution rate.
  const effectiveEnd = input.end < today ? input.end : today < input.start ? input.start : today;
  const occurrences = effectiveEnd < input.start ? [] : getOccurrencesForRange(routines, input.start, effectiveEnd, completions);
  const byRoutine = routines.flatMap(routine => {
    const rows = occurrences.filter(item => item.task.id === routine.id);
    if (!rows.length) return [];
    const completed = rows.filter(item => item.status === "done").length;
    const skipped = rows.filter(item => item.status === "skipped").length;
    const pending = rows.length - completed - skipped;
    return [{ id:routine.id, title:routine.title, scheduled:rows.length, completed, skipped, pending, completionRate:Math.round(completed / rows.length * 100) }];
  });
  const scheduled = occurrences.length;
  const completed = occurrences.filter(item => item.status === "done").length;
  const skipped = occurrences.filter(item => item.status === "skipped").length;
  const pending = scheduled - completed - skipped;
  const struggling = byRoutine.filter(item => item.scheduled >= 3 && item.completionRate < 60).sort((a,b)=>a.completionRate-b.completionRate || b.scheduled-a.scheduled).map(({id,title,scheduled,completed,completionRate})=>({id,title,scheduled,completed,completionRate}));
  return { scheduled, completed, skipped, pending, completionRate:scheduled?Math.round(completed/scheduled*100):0, byRoutine, struggling };
}
