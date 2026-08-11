import type { HomePeriod, HomeSummary } from "@/lib/planning/home-summary";
import styles from "./home-operations.module.css";

export function HomePeriodSwitcher({ value, onChange }: { value: HomePeriod; onChange: (value: HomePeriod) => void }) {
  return <nav className={styles.periodSwitch} aria-label="Home 운영 기간">{(["day", "week", "month"] as const).map(period => <button key={period} type="button" className={value === period ? styles.active : ""} aria-pressed={value === period} onClick={() => onChange(period)}>{period === "day" ? "오늘" : period === "week" ? "이번 주" : "이번 달"}</button>)}</nav>;
}
export function HomeOperations({ summary, onNavigate }: { summary: HomeSummary; onNavigate: (target: "weekly-plan" | "monthly-plan" | "calendar" | "tasks" | "projects" | "recurring") => void }) {
 const periodLabel=summary.period==="day"?"오늘":summary.period==="week"?"이번 주":"이번 달";
 const formatDate=(value:string)=>value.slice(5,10).replace("-",".");
 return <section className={styles.summary} aria-label={`${periodLabel} 운영 요약`}>
  <div className={styles.direction}>
   <article className={styles.card}><header><h3>방향 연결</h3><button onClick={()=>onNavigate(summary.period==="month"?"monthly-plan":"weekly-plan")}>계획 열기</button></header><div className={styles.hierarchy}>
    {summary.daily&&<><div><span>오늘 목표</span><strong>{summary.daily.goal||"오늘 목표를 정하면 운영 흐름이 시작됩니다."}</strong></div><div><span>선택 이유</span><p>{summary.daily.reason||"아직 선택 이유가 없습니다."}</p></div><div><span>즐길 것</span><p>{summary.daily.enjoyment||"오늘 즐길 것을 기록해 보세요."}</p></div>{summary.daily.linkedWeeklyGoal&&<div><span>주간 목표</span><strong>{summary.daily.linkedWeeklyGoal.title}</strong></div>}</>}
    {summary.directions.map((item,index)=><div key={`${item.label}-${item.contextId??"all"}-${index}`}><span>{item.label}</span><p>{item.value}</p></div>)}
    {!summary.daily&&!summary.directions.length&&<p className={styles.empty}>{periodLabel} 방향이 아직 없습니다. 계획 화면에서 이번 기간의 방향을 정해 보세요.</p>}
   </div></article>
   <article className={styles.card}><header><h3>{periodLabel} 목표</h3><button onClick={()=>onNavigate(summary.period==="month"?"monthly-plan":"weekly-plan")}>목표 관리</button></header><div className={styles.goals}>{summary.goals.slice(0,6).map(goal=><div key={goal.id} className={`${styles.goal} ${goal.status==="done"?styles.done:""}`}><i/><strong>{goal.title}</strong><small>{goal.priority==="high"?"높음":goal.priority==="low"?"낮음":"보통"} · {goal.status==="done"?"완료":goal.status==="active"?"진행":"보류"}</small></div>)}{!summary.goals.length&&<p className={styles.empty}>{periodLabel} 목표가 없습니다.</p>}</div></article>
  </div>
  <div className={styles.systems}>
   <SystemCard title="일정" action="캘린더" count={summary.events.length} completed={0} onOpen={()=>onNavigate("calendar")} items={summary.events.slice(0,4).map(item=>({label:item.title,meta:formatDate(item.start)}))} empty="이 기간에 표시할 일정이 없습니다."/>
   <SystemCard title="할 일" action="할 일" count={summary.todoProgress.total} completed={summary.todoProgress.completed} onOpen={()=>onNavigate("tasks")} items={summary.todos.slice(0,4).map(item=>({label:item.title,meta:item.done?"완료":formatDate(item.scheduledAt)}))} empty="이 기간에 할 일이 없습니다."/>
   <SystemCard title="반복 업무" action="반복 관리" count={summary.recurringProgress.total} completed={summary.recurringProgress.completed} onOpen={()=>onNavigate("recurring")} items={summary.recurring.slice(0,4).map(item=>({label:item.task.title,meta:item.status==="done"?"완료":formatDate(item.occurrenceDate)}))} empty="이 기간에 반복 업무가 없습니다."/>
   <SystemCard title="프로젝트" action="프로젝트" count={summary.projects.length} completed={0} onOpen={()=>onNavigate("projects")} items={summary.projects.slice(0,4).map(item=>({label:item.name,meta:`${item.progress}%`}))} empty="진행 중인 프로젝트가 없습니다."/>
  </div>
  <article className={styles.card}><header><h3>빠른 이동</h3></header><div className={styles.quickActions}><button onClick={()=>onNavigate("weekly-plan")}>이번 주 계획</button><button onClick={()=>onNavigate("monthly-plan")}>이번 달 계획</button><button onClick={()=>onNavigate("calendar")}>캘린더</button><button onClick={()=>onNavigate("tasks")}>할 일</button><button onClick={()=>onNavigate("recurring")}>반복 업무</button><button onClick={()=>onNavigate("projects")}>프로젝트</button></div></article>
 </section>;
}
function SystemCard({title,action,count,completed,onOpen,items,empty}:{title:string;action:string;count:number;completed:number;onOpen:()=>void;items:Array<{label:string;meta:string}>;empty:string}){return <article className={styles.card}><header><h3>{title}</h3><button onClick={onOpen}>{action}</button></header><div className={styles.metric}><strong>{count}</strong><span>{completed?`${completed} 완료 · ${Math.max(0,count-completed)} 남음`:"항목"}</span></div><div className={styles.list}>{items.map((item,index)=><p key={`${item.label}-${index}`}><span>{item.label}</span><small>{item.meta}</small></p>)}{!items.length&&<p className={styles.empty}>{empty}</p>}</div></article>}
