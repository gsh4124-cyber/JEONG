import type { Project, Review, TaskItem } from "./types";
import type { MorningBriefingEvent } from "./morning-briefing";

export type DailyProjectSummary = { id: string; name: string; total: number; completed: number };
export type DailyRecord = {
  date: string;
  morningDirection: { goal: string; reason: string; enjoyment: string; gratitude: string[] };
  schedules: MorningBriefingEvent[];
  todoSummary: { total: number; completed: number; incomplete: TaskItem[] };
  projectSummary: DailyProjectSummary[];
  eveningReview?: Review;
};

export function getDailyRecord(input: {
  date: string; goal: string; reason: string; enjoyment: string; gratitude: string[];
  tasks: TaskItem[]; events: MorningBriefingEvent[]; projects: Project[]; reviews: Record<string, Review>;
}): DailyRecord {
  const tasks = input.tasks.filter(task => task.bucket === "today" || task.scheduledAt?.slice(0, 10) === input.date);
  const projectIds = [...new Set(tasks.map(task => task.projectId).filter(Boolean))] as string[];
  const projectSummary = projectIds.flatMap(id => {
    const project = input.projects.find(item => item.id === id);
    if (!project) return [];
    const linked = tasks.filter(task => task.projectId === id);
    return [{ id, name: project.name, total: linked.length, completed: linked.filter(task => task.done).length }];
  });
  return {
    date: input.date,
    morningDirection: { goal: input.goal, reason: input.reason, enjoyment: input.enjoyment, gratitude: input.gratitude },
    schedules: input.events,
    todoSummary: { total: tasks.length, completed: tasks.filter(task => task.done).length, incomplete: tasks.filter(task => !task.done) },
    projectSummary,
    eveningReview: input.reviews[input.date],
  };
}

export const isEvening = (date = new Date(), thresholdHour = 19) => date.getHours() >= thresholdHour;
