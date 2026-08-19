export type AiPromptType = "morning" | "daily" | "weekly" | "project" | "free";

export type LifeStateEvent = {
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  context?: string;
  state?: "current" | "next" | "upcoming" | "done";
};

export type LifeStateTask = {
  title: string;
  done?: boolean;
  dueDate?: string;
  project?: string;
  context?: string;
  carried?: boolean;
};

export type LifeStateRoutine = {
  title: string;
  status: "done" | "pending" | "skipped";
  project?: string;
  milestone?: string;
};

export type LifeStateMilestone = {
  title: string;
  done: boolean;
  start?: string;
  due?: string;
  routines?: string[];
};

export type LifeStateProject = {
  name: string;
  goal?: string;
  status: string;
  progress?: number;
  start?: string;
  due?: string;
  nextAction?: string;
  stalled?: boolean;
  risks?: string[];
  milestones?: LifeStateMilestone[];
  routineCompleted?: number;
  routineScheduled?: number;
  recentActivity?: Array<{ date: string; title: string; kind: string }>;
};

export type LifeStateRecentRecord = {
  date: string;
  kind: string;
  title: string;
  project?: string;
  detail?: string;
};

export type LifeStateReview = {
  date: string;
  status?: string;
  goal?: string;
  enjoyment?: string;
  reason?: string;
  good?: string;
  learned?: string;
  joy?: string;
  eveningGratitude?: string[];
};

export type ChatGptLifeStateInput = {
  nowLabel: string;
  date: string;
  phase: string;
  morning: { goal?: string; enjoyment?: string; gratitude?: string[] };
  calendarState: "AVAILABLE" | "UNKNOWN" | "EMPTY";
  events: LifeStateEvent[];
  todos: {
    completed: number;
    total: number;
    incomplete: LifeStateTask[];
    overdue: LifeStateTask[];
    carry: LifeStateTask[];
    replanningReasons: string[];
  };
  routines: LifeStateRoutine[];
  weeklyGoals: string[];
  monthlyGoals: string[];
  projects: LifeStateProject[];
  focusProject?: string;
  recentRecords: LifeStateRecentRecord[];
  recentReviews: LifeStateReview[];
  facts30d: {
    todoRate: number;
    carry: number;
    overdue: number;
    routineRate: number;
    routineCompleted: number;
    routineScheduled: number;
    calendarAvailable: boolean;
    calendarCount: number;
    calendarMinutes: number;
    morningDays: number;
    reviewDays: number;
    stalledProjects: string[];
    strugglingRoutines: string[];
  };
  comparison30d: {
    todoRateDelta: number;
    carryDelta: number;
    overdueDelta: number;
    calendarMinutesDelta: number;
    morningDelta: number;
    reviewDelta: number;
  };
  weekly: { todoRate: number; incomplete: number; routineRate: number; calendarMinutes: number; projectActivity: number };
  monthly: { todoRate: number; incomplete: number; routineRate: number; calendarMinutes: number; projectActivity: number };
  peopleLines?: string[];
};

const compact = (value: string | undefined, max = 120) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const list = (items: string[], empty = "없음") => items.filter(Boolean).join(" / ") || empty;
const signed = (value: number, suffix = "") => `${value >= 0 ? "+" : ""}${value}${suffix}`;
const clock = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16) || value;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const eventLine = (event: LifeStateEvent) => {
  const state = event.state ? ` · ${event.state === "current" ? "진행 중" : event.state === "next" ? "다음" : event.state === "done" ? "종료" : "예정"}` : "";
  const time = event.allDay ? "종일" : event.end ? `${clock(event.start)}-${clock(event.end)}` : clock(event.start);
  return `- ${time} · ${compact(event.title, 70)}${event.context ? ` · ${event.context}` : ""}${state}`;
};

const taskLine = (task: LifeStateTask) =>
  `- ${compact(task.title, 80)}${task.project ? ` · 프로젝트 ${task.project}` : ""}${task.dueDate ? ` · 기한 ${task.dueDate.slice(0, 10)}` : ""}${task.carried ? " · 이월" : ""}`;

const routineLine = (routine: LifeStateRoutine) =>
  `- ${routine.status === "done" ? "완료" : routine.status === "skipped" ? "건너뜀" : "미완료"} · ${compact(routine.title, 70)}${routine.project ? ` · ${routine.project}` : ""}${routine.milestone ? ` > ${routine.milestone}` : ""}`;

const projectLines = (projects: LifeStateProject[], focusProject?: string) => {
  if (!projects.length) return "- 활성 프로젝트 없음";
  return projects.map((project) => {
    const focus = focusProject === project.name ? "[현재 포커스] " : "";
    const milestoneText = (project.milestones ?? []).filter(item => !item.done).slice(0, 4).map(item => {
      const dates = item.start || item.due ? ` (${item.start ?? "?"}~${item.due ?? "?"})` : "";
      const routines = item.routines?.length ? ` [루틴: ${item.routines.slice(0, 4).join(", ")}]` : "";
      return `${item.title}${dates}${routines}`;
    });
    const recent = (project.recentActivity ?? []).slice(0, 3).map(item => `${item.date} ${item.title}`).join(" / ");
    return `- ${focus}${project.name}: 상태 ${project.status}${project.progress !== undefined ? ` · 진행 ${project.progress}%` : ""}${project.start || project.due ? ` · 기간 ${project.start ?? "?"}~${project.due ?? "?"}` : ""}\n  목표: ${compact(project.goal, 100) || "미입력"}\n  다음 행동: ${compact(project.nextAction, 90) || "미입력"}${milestoneText.length ? `\n  미완료 중간목표: ${milestoneText.join(" / ")}` : ""}${project.routineScheduled ? `\n  루틴: ${project.routineCompleted ?? 0}/${project.routineScheduled}회 완료` : ""}${project.risks?.length ? `\n  위험 신호: ${project.risks.join(" / ")}` : project.stalled ? "\n  위험 신호: 정체" : ""}${recent ? `\n  최근 활동: ${recent}` : ""}`;
  }).join("\n");
};

const requests: Record<AiPromptType, string> = {
  morning: "오늘의 방향과 실제 시간표·Todo·Routine·Project를 함께 보고, 사실을 먼저 요약한 뒤 지금부터 오늘을 운영할 가장 중요한 행동 후보를 최대 3개 제안해줘. 확정 일정은 바꾸지 말고, 제안과 사실을 구분해.",
  daily: "현재 상태를 점검해줘. 끝난 것 / 남은 것 / 놓치기 쉬운 것 / 다음 행동 후보를 구분해. 재계획이 필요하다면 어떤 데이터 때문에 그런지 먼저 말하고 변경안은 제안으로만 제시해.",
  weekly: "이번 주 실행 데이터를 해석해줘. 무엇이 실제로 진행됐는지, 무엇이 반복해서 밀렸는지, Project와 Routine 흐름이 어땠는지 구분해. 상관관계를 인과관계로 단정하지 말고 다음 주 조정 후보를 제안해.",
  project: "현재 포커스 프로젝트를 중심으로 목표·중간목표·연결 Todo·Routine·최근 활동을 함께 봐줘. 정체 원인은 데이터 기반 가설로만 제시하고, 가장 자연스러운 다음 행동 후보를 최대 3개 제안해.",
  free: "아래 JEONG Life State를 현재 삶의 구조화된 참고자료로 사용해줘. 이어지는 질문에 답할 때 기록된 사실과 너의 해석을 구분하고 데이터에 없는 사실은 만들어내지 마.",
};

export function buildChatGptLifeStatePrompt(type: AiPromptType, input: ChatGptLifeStateInput) {
  const eventLines = input.events.slice(0, 12).map(eventLine);
  const routineLines = input.routines.slice(0, 15).map(routineLine);
  const recentRecordLines = input.recentRecords.slice(0, 10).map(item =>
    `- ${item.date} · ${item.kind}${item.project ? ` · ${item.project}` : ""} · ${compact(item.title, 80)}${item.detail ? ` — ${compact(item.detail, 100)}` : ""}`,
  );
  const reviewStatusLabel: Record<string, string> = { done: "완료", not_done: "미완료", changed: "우선순위 변경" };
  const reviewLines = input.recentReviews.slice(0, 3).map(review => {
    const details = [
      review.status ? `목표 결과: ${reviewStatusLabel[review.status] ?? review.status}` : "",
      review.goal ? `목표: ${compact(review.goal, 100)}` : "",
      review.enjoyment ? `즐길 것: ${compact(review.enjoyment, 80)}` : "",
      review.reason ? `결과 메모: ${compact(review.reason, 100)}` : "",
      review.good ? `잘한 점: ${compact(review.good, 100)}` : "",
      review.learned ? `배운 점: ${compact(review.learned, 100)}` : "",
      review.joy ? `즐거웠던 순간: ${compact(review.joy, 100)}` : "",
      review.eveningGratitude?.length ? `저녁 감사: ${list(review.eveningGratitude)}` : "",
    ].filter(Boolean);
    return details.length ? `- ${review.date} · ${details.join(" · ")}` : `- ${review.date} · 작성 내용 없음`;
  });

  const context = `[JEONG LIFE STATE v2]
기준 날짜: ${input.date}
기준 시각: ${input.nowLabel}
운영 단계: ${input.phase}

[오늘의 방향]
목표: ${compact(input.morning.goal, 160) || "미입력"}
즐길 것: ${compact(input.morning.enjoyment, 120) || "미입력"}
감사: ${list(input.morning.gratitude ?? [], "미입력")}

[오늘 Calendar]
상태: ${input.calendarState === "AVAILABLE" ? "연결됨" : input.calendarState === "EMPTY" ? "일정 없음" : "확인 불가"}
${eventLines.join("\n") || "- 일정 없음"}

[오늘 Todo]
완료: ${input.todos.completed}/${input.todos.total}
미완료:
${input.todos.incomplete.slice(0, 12).map(taskLine).join("\n") || "- 없음"}
Overdue:
${input.todos.overdue.slice(0, 8).map(taskLine).join("\n") || "- 없음"}
Carry:
${input.todos.carry.slice(0, 8).map(taskLine).join("\n") || "- 없음"}
재계획 신호: ${list(input.todos.replanningReasons)}

[오늘 Routine]
${routineLines.join("\n") || "- 예정 루틴 없음"}

[활성 목표]
이번 주: ${list(input.weeklyGoals)}
이번 달: ${list(input.monthlyGoals)}

[Project]
${projectLines(input.projects, input.focusProject)}

[최근 실행·기록]
${recentRecordLines.join("\n") || "- 기록 없음"}

[최근 Evening Review]
${reviewLines.join("\n") || "- 리뷰 없음"}

[최근 30일 사실]
Todo 완료율 ${input.facts30d.todoRate}% · Carry ${input.facts30d.carry}회 · Overdue ${input.facts30d.overdue}개
Routine ${input.facts30d.routineRate}% (${input.facts30d.routineCompleted}/${input.facts30d.routineScheduled})
Calendar ${input.facts30d.calendarAvailable ? `${input.facts30d.calendarCount}건 / ${Math.round(input.facts30d.calendarMinutes / 60)}시간` : "확인 불가"}
Morning ${input.facts30d.morningDays}일 · Evening Review ${input.facts30d.reviewDays}일
정체 Project: ${list(input.facts30d.stalledProjects)}
낮은 수행률 Routine: ${list(input.facts30d.strugglingRoutines)}

[직전 30일 대비]
Todo 완료율 ${signed(input.comparison30d.todoRateDelta, "%p")} · Carry ${signed(input.comparison30d.carryDelta, "회")} · Overdue ${signed(input.comparison30d.overdueDelta, "개")}
Calendar ${signed(Math.round(input.comparison30d.calendarMinutesDelta), "분")} · Morning ${signed(input.comparison30d.morningDelta, "일")} · Review ${signed(input.comparison30d.reviewDelta, "일")}

[기간 흐름]
이번 주: Todo ${input.weekly.todoRate}% · 미완료 ${input.weekly.incomplete}개 · Routine ${input.weekly.routineRate}% · Calendar ${Math.round(input.weekly.calendarMinutes / 60)}시간 · Project 활동 ${input.weekly.projectActivity}
이번 달: Todo ${input.monthly.todoRate}% · 미완료 ${input.monthly.incomplete}개 · Routine ${input.monthly.routineRate}% · Calendar ${Math.round(input.monthly.calendarMinutes / 60)}시간 · Project 활동 ${input.monthly.projectActivity}

[연락 확인]
${input.peopleLines?.length ? input.peopleLines.slice(0, 10).map(line => `- ${compact(line, 120)}`).join("\n") : "(제외 또는 해당 없음)"}`;

  return `역할 분담:
- JEONG은 사용자의 삶의 상태·기록·계산된 사실을 보존한다.
- ChatGPT는 그 구조화된 데이터를 해석하고 함께 생각한다.
- 사실, 해석, 제안을 서로 구분한다.
- 사용자의 선택을 대신하지 않는다.
- JEONG 데이터에 없는 원인·일정·완료 사실을 만들어내지 않는다.
- Calendar에 이미 잡힌 일정은 확정 시간으로 취급하고, 변경이 필요하면 먼저 제안만 한다.

요청:
${requests[type]}

${context}`;
}
