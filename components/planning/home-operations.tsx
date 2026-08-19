import { useState } from "react";
import type { Context, ContextFilterValue, Project } from "@/lib/planning/types";
import type { HomeSummary } from "@/lib/planning/home-summary";
import { ContextFilter } from "./context-filter";
import styles from "./home-operations.module.css";

const projectStatusLabel: Record<Project["status"], string> = {
  planning: "기획",
  active: "진행 중",
  review: "검토 중",
  done: "완료",
};

const compactDate = (value?: string) => value ? value.replaceAll("-", ".") : "미정";

const homeRoutineLabel = (item: HomeSummary["recurring"][number]) => {
  const rule = item.task.recurrence;
  if (rule.type !== "WEEKLY" || (rule.interval ?? 1) !== 1) return "루틴";
  const days = [...rule.weekdays].sort((a, b) => a - b);
  // The dedicated WEEKENDS shortcut is a normal routine, not a weekly routine.
  if (days.length === 2 && days[0] === 0 && days[1] === 6) return "루틴";
  return "주간 루틴";
};

export function HomeOperations({
  summary,
  contexts,
  onAddTask,
  onAddRoutine,
  onEditTask,
  onDeleteTask,
  onToggleTask,
  onToggleRecurring,
  onSetTasksDone,
  onSetRoutinesDone,
}: {
  summary: HomeSummary;
  contexts: Context[];
  onAddTask: (title: string, bucket: "today" | "week" | "month" | "someday", contextId?: string) => void;
  onAddRoutine: (title: string, mode: "DAILY" | "WEEKDAYS" | "WEEKENDS" | "WEEKLY" | "BIWEEKLY", contextId?: string) => void;
  onEditTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onToggleRecurring: (taskId: string, occurrenceDate: string) => void;
  onSetTasksDone: (taskIds: string[], done: boolean) => void;
  onSetRoutinesDone: (items: {taskId:string; occurrenceDate:string}[], done: boolean) => void;
}) {
  const [mode, setMode] = useState<"todos" | "routines">("todos");
  const [executionContext, setExecutionContext] = useState<ContextFilterValue>("ALL");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickBucket, setQuickBucket] = useState<"today" | "week" | "month" | "someday">("today");
  const [quickRoutineMode, setQuickRoutineMode] = useState<"DAILY" | "WEEKDAYS" | "WEEKENDS" | "WEEKLY" | "BIWEEKLY">("DAILY");
  const executionContextId = executionContext === "ALL" ? undefined : contexts.find(context => context.key === executionContext)?.id;
  const todos = summary.todos.filter(item => !executionContextId || item.contextId === executionContextId).sort((a, b) => Number(a.done) - Number(b.done) || (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title));
  const routines = summary.recurring.filter(item => !executionContextId || item.task.contextId === executionContextId).sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || (a.task.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.task.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.task.title.localeCompare(b.task.title));
  const todoCompleted = todos.filter(item => item.done).length;
  const routineCompleted = routines.filter(item => item.status === "done").length;
  const rows = mode === "todos" ? todos : routines;
  const completed = mode === "todos" ? todoCompleted : routineCompleted;
  const total = rows.length;
  const progress = total ? Math.round(completed / total * 100) : 0;
  const allDone = total > 0 && completed === total;
  const title = mode === "todos" ? "오늘 할 일" : "오늘 루틴";

  return <section className={styles.summary} aria-label="오늘 실행 요약">
    <article className={`${styles.card} ${styles.todoCard}`}>
      <header className={styles.todoHeader}>
        <div><h3>{title}</h3><span>{completed}/{total} 완료</span></div>
        <div className={styles.todoHeaderActions}>
          {total > 1 && <button type="button" onClick={() => {
            if(mode === "todos") onSetTasksDone(todos.map(item=>item.id),!allDone);
            else onSetRoutinesDone(routines.map(item=>({taskId:item.task.id,occurrenceDate:item.occurrenceDate})),!allDone);
          }}>{allDone ? "전체 해제" : "전체 체크"}</button>}
        </div>
      </header>
      <div className={styles.todoProgress} aria-label={`${title} 진행률 ${progress}%`}>
        <div className={styles.todoProgressRing} style={{background:`conic-gradient(var(--home-gold) ${progress}%, var(--home-border) ${progress}% 100%)`}}><span>{progress}%</span></div>
        <div><strong>{mode === "todos" ? "할 일 진행률" : "루틴 진행률"}</strong><small>완료 {completed} / 전체 {total}</small></div>
      </div>
      <div className={styles.todoModeTabs} role="tablist" aria-label="할 일과 루틴 전환">
        <button type="button" role="tab" aria-selected={mode === "todos"} className={mode === "todos" ? styles.active : ""} onClick={() => setMode("todos")}>할 일 <span>{todos.length}</span></button>
        <button type="button" role="tab" aria-selected={mode === "routines"} className={mode === "routines" ? styles.active : ""} onClick={() => setMode("routines")}>루틴 <span>{routines.length}</span></button>
      </div>
      {mode === "todos" ? <form className={styles.quickAdd} onSubmit={event => {event.preventDefault(); const title=quickTitle.trim(); if(!title)return; onAddTask(title,quickBucket,executionContextId); setQuickTitle("");}}>
        <input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder="할 일 추가" aria-label="할 일 제목"/>
        <select value={quickBucket} onChange={event => setQuickBucket(event.target.value as typeof quickBucket)} aria-label="할 일 기간"><option value="today">오늘</option><option value="week">이번 주</option><option value="month">이번 달</option><option value="someday">언젠가</option></select>
        <button type="submit">추가</button>
      </form> : <form className={styles.quickAdd} onSubmit={event => {event.preventDefault(); const title=quickTitle.trim(); if(!title)return; onAddRoutine(title,quickRoutineMode,executionContextId); setQuickTitle("");}}>
        <input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder="루틴 추가" aria-label="루틴 제목"/>
        <select value={quickRoutineMode} onChange={event => setQuickRoutineMode(event.target.value as typeof quickRoutineMode)} aria-label="루틴 주기"><option value="DAILY">매일</option><option value="WEEKDAYS">평일</option><option value="WEEKENDS">주말</option><option value="WEEKLY">매주</option><option value="BIWEEKLY">격주</option></select>
        <button type="submit">추가</button>
      </form>}
      <div className={styles.contextFilterWrap}><ContextFilter contexts={contexts} value={executionContext} onChange={setExecutionContext} ariaLabel="홈 실행 맥락 필터"/></div>
      <div className={styles.todoList}>
        {mode === "todos" && todos.map(item => <div key={item.id} className={`${styles.todoRow} ${item.done ? styles.done : ""}`}>
          <button type="button" className={styles.todoToggle} onClick={() => onToggleTask(item.id)} aria-label={`${item.title} ${item.done ? "미완료로 변경" : "완료 처리"}`}><i aria-hidden="true">{item.done ? "✓" : ""}</i><span>{item.title}</span><small>{item.done ? "완료" : "할 일"}</small></button>
          <div className={styles.todoRowActions}><button type="button" onClick={() => onEditTask(item.id)} aria-label={`${item.title} 수정`}>✎</button><button type="button" onClick={() => onDeleteTask(item.id)} aria-label={`${item.title} 삭제`}>×</button></div>
        </div>)}
        {mode === "routines" && routines.map(item => <button type="button" key={`${item.task.id}-${item.occurrenceDate}`} className={item.status === "done" ? styles.done : ""} onClick={() => onToggleRecurring(item.task.id, item.occurrenceDate)}>
          <i aria-hidden="true">{item.status === "done" ? "✓" : ""}</i><span>{item.task.title}</span><small>{item.status === "done" ? "완료" : homeRoutineLabel(item)}</small>
        </button>)}
        {!total && <p className={styles.empty}>{mode === "todos" ? "이 맥락의 오늘 할 일이 없습니다." : "이 맥락의 오늘 루틴이 없습니다."}</p>}
      </div>
    </article>
  </section>;
}

export function HomeProjectSummary({ summary, onNavigate }: { summary: HomeSummary; onNavigate: (target: "calendar" | "projects") => void }) {
  return <section className={styles.projectSummary} aria-label="Home 프로젝트 요약">
    <article className={`${styles.card} ${styles.projectCard}`}>
      <header className={styles.projectHeader}>
        <div><h3>프로젝트</h3><span>{summary.projects.length}개 운영 중</span></div>
        <button onClick={() => onNavigate("projects")}>프로젝트</button>
      </header>
      <div className={styles.projectGrid}>
        {summary.projects.slice(0, 4).map(project => <button type="button" key={project.id} className={styles.projectItem} onClick={() => onNavigate("projects")}>
          <div className={styles.projectItemTop}>
            <strong>{project.name}</strong>
            <span className={styles.projectMetaSide}><em>{projectStatusLabel[project.status]}</em><b>{project.progress}%</b></span>
          </div>
          <p>{project.goal || "목표 미설정"}</p>
          <div className={styles.projectPeriod}><span>시작 {compactDate(project.startDate)}</span><span>마감 {compactDate(project.dueDate)}</span></div>
          <div className={styles.projectProgressTrack}><i style={{width:`${project.progress}%`}} /></div>
        </button>)}
        {!summary.projects.length && <p className={styles.empty}>진행 중인 프로젝트가 없습니다.</p>}
      </div>
    </article>
  </section>;
}
