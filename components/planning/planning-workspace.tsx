"use client";
import { useMemo, useState } from "react";
import { ContextFilter } from "./context-filter";
import { getOccurrencesForRange } from "@/lib/planning/recurrence";
import { getGoalsByContext, getGoalsForPeriod, getPlanForPeriod } from "@/lib/planning/plans";
import type { Context, ContextFilterValue, Goal, Plan, Project, RecurringTaskCompletion, RecurringTaskDefinition, TaskItem } from "@/lib/planning/types";
import styles from "./planning-workspace.module.css";

type CalendarSummary={id:string;title:string;start:string;calendarId?:string};
type Props={horizon:"MONTH"|"WEEK";range:{start:string;end:string};contexts:Context[];contextFilter:ContextFilterValue;onContextFilter:(v:ContextFilterValue)=>void;plans:Plan[];goals:Goal[];projects:Project[];tasks:TaskItem[];recurringTasks:RecurringTaskDefinition[];completions:RecurringTaskCompletion[];events:CalendarSummary[];eventContextId:(event:CalendarSummary)=>string|undefined;onNavigate:(direction:-1|1)=>void;onUpsertPlan:(plan:Plan)=>void;onUpsertGoal:(goal:Goal)=>void;onRemoveGoal:(id:string)=>void};
const uid=()=>crypto.randomUUID?.()??`${Date.now()}-${Math.random()}`;
const stamp=()=>new Date().toISOString();
const inRange=(value:string,start:string,end:string)=>{const key=value.slice(0,10);return key>=start&&key<=end};
export function PlanningWorkspace(p:Props){
 const contextId=p.contextFilter==="ALL"?undefined:p.contexts.find(c=>c.key===p.contextFilter)?.id;
 const plan=getPlanForPeriod(p.plans,p.horizon,p.range.start,contextId);
 const [draft,setDraft]=useState("");
 const direction=plan?.direction??draft;
 const periodGoals=useMemo(()=>getGoalsByContext(getGoalsForPeriod(p.goals,p.horizon,p.range.start),p.contexts,p.contextFilter),[p.goals,p.horizon,p.range.start,p.contexts,p.contextFilter]);
 const parentGoals=p.horizon==="WEEK"?getGoalsForPeriod(p.goals,"MONTH",p.range.start.slice(0,7)+"-01"):[];
 const events=p.events.filter(e=>inRange(e.start,p.range.start,p.range.end)&&(!contextId||p.eventContextId(e)===contextId));
 const tasks=p.tasks.filter(t=>t.scheduledAt&&inRange(t.scheduledAt,p.range.start,p.range.end)&&(!contextId||t.contextId===contextId));
 const recurring=getOccurrencesForRange(p.recurringTasks,p.range.start,p.range.end,p.completions).filter(o=>!contextId||o.task.contextId===contextId);
 const projects=p.projects.filter(x=>x.status!=="done"&&(!contextId||x.contextId===contextId));
 const saveDirection=(value:string)=>{setDraft(value);const now=stamp();p.onUpsertPlan({id:plan?.id??uid(),horizon:p.horizon,contextId,periodStart:p.range.start,periodEnd:p.range.end,direction:value,focus:plan?.focus??[],reviewNote:plan?.reviewNote,createdAt:plan?.createdAt??now,updatedAt:now})};
 const addGoal=()=>{const now=stamp();p.onUpsertGoal({id:uid(),horizon:p.horizon,contextId,periodStart:p.range.start,periodEnd:p.range.end,title:"새 목표",status:"active",priority:"normal",createdAt:now,updatedAt:now})};
 const patchGoal=(goal:Goal,patch:Partial<Goal>)=>p.onUpsertGoal({...goal,...patch,updatedAt:stamp()});
 const label=p.horizon==="MONTH"?"이번 달":"이번 주";
 return <section className={styles.workspace}>
  <header className={styles.header}><div><span>{p.horizon==="MONTH"?"Monthly Planning":"Weekly Planning"}</span><h2>{p.range.start} — {p.range.end}</h2></div><nav><button onClick={()=>p.onNavigate(-1)}>← 이전</button><button onClick={()=>p.onNavigate(1)}>다음 →</button></nav></header>
  <ContextFilter contexts={p.contexts} value={p.contextFilter} onChange={p.onContextFilter}/>
  <div className={styles.grid}>
   <article className={styles.primary}><label><span>{label} 방향</span><textarea value={direction} onChange={e=>saveDirection(e.target.value)} placeholder={`${label}의 방향을 적어주세요.`}/></label>
    {p.horizon==="WEEK"&&<div className={styles.reference}><strong>이번 달 방향</strong><p>{getPlanForPeriod(p.plans,"MONTH",p.range.start.slice(0,7)+"-01",contextId)?.direction||"아직 월간 방향이 없습니다."}</p></div>}
    <div className={styles.goalHead}><div><strong>{label} 목표</strong><small>{p.horizon==="MONTH"?"핵심 목표 5개 내외를 권장합니다.":"핵심 목표 3개 내외를 권장합니다."}</small></div><button onClick={addGoal}>+ 목표 추가</button></div>
    <div className={styles.goals}>{periodGoals.map(g=><article key={g.id}><input className={styles.goalTitle} value={g.title} onChange={e=>patchGoal(g,{title:e.target.value})}/><div className={styles.goalMeta}><select value={g.contextId??""} onChange={e=>patchGoal(g,{contextId:e.target.value||undefined})}><option value="">전체 맥락</option>{p.contexts.filter(c=>c.isActive).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select value={g.priority} onChange={e=>patchGoal(g,{priority:e.target.value as Goal["priority"]})}><option value="low">낮음</option><option value="normal">보통</option><option value="high">높음</option></select><select value={g.status} onChange={e=>patchGoal(g,{status:e.target.value as Goal["status"]})}><option value="active">진행</option><option value="done">완료</option><option value="paused">보류</option><option value="cancelled">취소</option></select><select value={g.projectId??""} onChange={e=>patchGoal(g,{projectId:e.target.value||undefined})}><option value="">프로젝트 없음</option>{p.projects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>{p.horizon==="WEEK"&&<select value={g.parentGoalId??""} onChange={e=>patchGoal(g,{parentGoalId:e.target.value||undefined})}><option value="">월간 목표 연결 안 함</option>{parentGoals.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select>}<button aria-label="목표 삭제" onClick={()=>p.onRemoveGoal(g.id)}>삭제</button></div></article>)}</div>
   </article>
   <aside className={styles.summary}>
    <Summary title="중요 일정" items={events.map(e=>`${e.start.slice(5,10)} · ${e.title}`)}/><Summary title="할 일" items={tasks.map(t=>`${t.scheduledAt.slice(5,10)} · ${t.title}`)}/><Summary title="반복 업무" items={recurring.slice(0,8).map(o=>`${o.occurrenceDate.slice(5)} · ${o.task.title}${o.status==="done"?" ✓":""}`)}/><Summary title="진행 프로젝트" items={projects.map(x=>x.name)}/>
   </aside>
  </div>
 </section>
}
function Summary({title,items}:{title:string;items:string[]}){return <article><strong>{title}</strong>{items.slice(0,6).map((x,i)=><p key={`${x}-${i}`}>{x}</p>)}{!items.length&&<small>해당 기간의 항목이 없습니다.</small>}</article>}
