"use client";

import { useState } from "react";
import { ContextPicker } from "./context-picker";
import styles from "./recurring-task.module.css";
import type { Context, Project, RecurrenceRule, RecurringTaskDefinition } from "@/lib/planning/types";

type CalendarOption = { id: string; name: string };
type RecurrenceMode = "DAILY" | "WEEKDAYS" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

const modeFor = (rule?: RecurrenceRule): RecurrenceMode =>
  rule?.type === "WEEKLY" && rule.interval === 2 ? "BIWEEKLY" : rule?.type ?? "DAILY";

export function RecurringTaskEditor({
  contexts, projects, calendars, initial, defaultContextId, defaultCalendarId, calendarForContext, onSave, onCancel,
}: {
  contexts: Context[];
  projects: Project[];
  calendars: CalendarOption[];
  initial?: RecurringTaskDefinition;
  defaultContextId: string;
  defaultCalendarId?: string;
  calendarForContext: (contextId: string) => string | undefined;
  onSave: (value: Omit<RecurringTaskDefinition, "id" | "createdAt" | "updatedAt" | "calendarEventId">) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [contextId, setContextId] = useState(initial?.contextId ?? defaultContextId);
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [mode, setMode] = useState<RecurrenceMode>(modeFor(initial?.recurrence));
  const [weekdays, setWeekdays] = useState(initial?.recurrence.type === "WEEKLY" ? initial.recurrence.weekdays : [new Date().getDay()]);
  const [monthlyDay, setMonthlyDay] = useState(initial?.recurrence.type === "MONTHLY" ? initial.recurrence.dayOfMonth : 1);
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toLocaleDateString("sv-SE"));
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [timeOfDay, setTimeOfDay] = useState(initial?.timeOfDay ?? "");
  const [durationMinutes, setDurationMinutes] = useState(initial?.durationMinutes ?? 30);
  const [priority, setPriority] = useState(initial?.priority ?? "normal");
  const [showOnCalendar, setShowOnCalendar] = useState(initial?.showOnCalendar ?? false);
  const [calendarId, setCalendarId] = useState(initial?.calendarId ?? defaultCalendarId ?? "");

  const recurrence: RecurrenceRule = mode === "DAILY" ? { type: "DAILY" }
    : mode === "WEEKDAYS" ? { type: "WEEKDAYS" }
    : mode === "MONTHLY" ? { type: "MONTHLY", dayOfMonth: monthlyDay }
    : { type: "WEEKLY", weekdays, interval: mode === "BIWEEKLY" ? 2 : 1 };

  return <div className="overlay">
    <form className={`editModal ${styles.editor}`} onSubmit={async event => {
      event.preventDefault();
      if (!title.trim() || ((mode === "WEEKLY" || mode === "BIWEEKLY") && !weekdays.length)) return;
      await onSave({ title: title.trim(), description: description.trim(), contextId, projectId: projectId || undefined,
        recurrence, startDate, endDate: endDate || undefined, timeOfDay: timeOfDay || undefined,
        durationMinutes, priority, showOnCalendar: showOnCalendar && !!timeOfDay,
        calendarId: showOnCalendar && timeOfDay ? calendarId || undefined : undefined,
        isActive: initial?.isActive ?? true });
    }}>
      <div className="modalHead"><div><span>Recurring Work</span><h2>{initial ? "반복 업무 수정" : "반복 업무 추가"}</h2></div><button type="button" onClick={onCancel}>닫기</button></div>
      <label>업무명<input required value={title} onChange={event => setTitle(event.target.value)} placeholder="반복해서 처리할 책임" /></label>
      <label>설명<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
      <div className="twoFields">
        <ContextPicker contexts={contexts} value={contextId} onChange={value => {const next=value ?? defaultContextId;setContextId(next);setCalendarId(calendarForContext(next) ?? calendarId)}} allowUnassigned={false}/>
        <label>프로젝트<select value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">연결 안 함</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      </div>
      <label>반복<select value={mode} onChange={event => setMode(event.target.value as RecurrenceMode)}><option value="DAILY">매일</option><option value="WEEKDAYS">평일</option><option value="WEEKLY">특정 요일</option><option value="BIWEEKLY">격주</option><option value="MONTHLY">매월 특정 날짜</option></select></label>
      {(mode === "WEEKLY" || mode === "BIWEEKLY") && <div className={styles.weekdays}>{["일","월","화","수","목","금","토"].map((name, day) => <label key={name} className={weekdays.includes(day) ? styles.selected : ""}><input type="checkbox" checked={weekdays.includes(day)} onChange={event => setWeekdays(event.target.checked ? [...weekdays, day].sort() : weekdays.filter(value => value !== day))}/>{name}</label>)}</div>}
      {mode === "MONTHLY" && <label>매월 날짜<input type="number" min="1" max="31" value={monthlyDay} onChange={event => setMonthlyDay(Math.min(31, Math.max(1, Number(event.target.value))))}/></label>}
      <div className="twoFields"><label>시작일<input required type="date" value={startDate} onChange={event => setStartDate(event.target.value)}/></label><label>종료일 (선택)<input type="date" min={startDate} value={endDate} onChange={event => setEndDate(event.target.value)}/></label></div>
      <div className="twoFields"><label>시간 (선택)<input type="time" value={timeOfDay} onChange={event => setTimeOfDay(event.target.value)}/></label><label>예상 시간(분)<input type="number" min="5" step="5" value={durationMinutes} onChange={event => setDurationMinutes(Number(event.target.value))}/></label></div>
      <label>우선순위<select value={priority} onChange={event => setPriority(event.target.value as RecurringTaskDefinition["priority"])}><option value="low">낮음</option><option value="normal">보통</option><option value="high">높음</option></select></label>
      <label className="checkRow"><input type="checkbox" checked={showOnCalendar} onChange={event => setShowOnCalendar(event.target.checked)}/>Google Calendar에도 표시</label>
      {showOnCalendar && <>{!timeOfDay && <p className={styles.hint}>시간을 지정해야 Calendar에 표시됩니다.</p>}<label>저장할 캘린더<select value={calendarId} onChange={event => setCalendarId(event.target.value)}><option value="">기본 캘린더</option>{calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></label></>}
      <button className="goldBtn" type="submit">{initial ? "변경 저장" : "반복 업무 만들기"}</button>
    </form>
  </div>;
}
