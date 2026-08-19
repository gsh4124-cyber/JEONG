import type { Project, TaskItem } from "./types";
import type { MorningBriefingEvent } from "./morning-briefing";
import type { DailyContinuity } from "./daily-continuity";
import type { ProjectIntelligence } from "./project-intelligence";
import type { MonthlySummary } from "./monthly-intelligence";
export type ReminderType="upcoming_event"|"current_event"|"todo_due"|"unfinished_todos"|"missing_direction"|"calendar_conflict"|"busy_schedule"|"project_task"|"day_closing"|"overdue_todo"|"repeated_defer"|"project_deadline"|"project_stalled"|"monthly_review";
export type ReminderSeverity="info"|"attention"|"important";
export type ProactiveReminder={id:string;type:ReminderType;severity:ReminderSeverity;title:string;message:string;relatedEntityType?:"event"|"task"|"project";relatedEntityId?:string;createdAt:string;expiresAt:string;action?:"calendar"|"tasks"|"morning"|"projects"};
const clock=(v:string)=>new Date(v).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});
const weight:{[K in ReminderSeverity]:number}={important:3,attention:2,info:1};
export function createProactiveReminders(input:{now:Date;date:string;events:MorningBriefingEvent[];todos:TaskItem[];projects:Project[];directionComplete:boolean;continuity?:DailyContinuity;projectIntelligence?:ProjectIntelligence[];monthlySummary?:MonthlySummary}):ProactiveReminder[]{
 const now=input.now.getTime(),out:ProactiveReminder[]=[];const add=(type:ReminderType,severity:ReminderSeverity,title:string,message:string,expires:number,entity?:{type:"event"|"task"|"project";id:string},action?:ProactiveReminder["action"])=>out.push({id:`${type}:${entity?.id??input.date}:${expires}`,type,severity,title,message,relatedEntityType:entity?.type,relatedEntityId:entity?.id,createdAt:input.now.toISOString(),expiresAt:new Date(expires).toISOString(),action});
 const events=[...input.events].filter(e=>new Date(e.end||e.start).getTime()>now).sort((a,b)=>a.start.localeCompare(b.start));
 const current=events.find(e=>new Date(e.start).getTime()<=now);if(current)add("current_event","attention","진행 중인 일정",`현재 ${current.title} 일정 중입니다.`,new Date(current.end).getTime(),{type:"event",id:current.id},"calendar");
 const next=events.find(e=>new Date(e.start).getTime()>now);if(next){const gap=new Date(next.start).getTime()-now,threshold=gap<=600000?10:gap<=1800000?30:gap<=3600000?60:0;if(threshold)add("upcoming_event",threshold===10?"important":"attention","다가오는 일정",`${clock(next.start)} ${next.title}까지 ${threshold}분 남았습니다.`,new Date(next.start).getTime(),{type:"event",id:next.id},"calendar")}
 const today=input.todos.filter(t=>t.scheduledAt?.slice(0,10)===input.date||(!t.scheduledAt&&t.doneAt===input.date)),open=today.filter(t=>!t.done);const due=open.filter(t=>t.scheduledAt&&new Date(t.scheduledAt).getTime()>now&&new Date(t.scheduledAt).getTime()-now<=3600000);due.forEach(t=>add("todo_due","attention","마감 임박 할 일",`${t.title} 처리 시간이 임박했습니다.`,new Date(t.scheduledAt).getTime(),{type:"task",id:t.id},"tasks"));
 const dayEnd=new Date(input.now.getFullYear(),input.now.getMonth(),input.now.getDate()+1).getTime();if(!input.directionComplete&&input.now.getHours()<12)add("missing_direction","info","오늘의 방향","오늘의 방향이 아직 정해지지 않았습니다.",new Date(input.now.getFullYear(),input.now.getMonth(),input.now.getDate(),12).getTime(),undefined,"morning");
 input.projects.filter(p=>open.some(t=>t.projectId===p.id)).forEach(p=>add("project_task","info","프로젝트 연결 할 일",`${p.name} 프로젝트에 오늘 할 일이 있습니다.`,dayEnd,{type:"project",id:p.id},"projects"));if(open.length&&input.now.getHours()>=20)add("day_closing","attention","하루 마감",`오늘 할 일이 ${open.length}개 남아 있습니다.`,dayEnd,undefined,"tasks");
 input.continuity?.overdue.forEach(item=>add("overdue_todo","important","마감이 지난 할 일",`${item.title}의 마감일이 지났습니다.`,dayEnd,{type:"task",id:item.todoId},"tasks"));
 input.continuity?.repeatedlyDeferred.forEach(item=>add("repeated_defer","attention","반복해서 미뤄진 할 일",`${item.title}이(가) ${item.carryCount}회 미뤄졌습니다.`,dayEnd,{type:"task",id:item.todoId},"tasks"));
 input.projectIntelligence?.filter(info=>info.health!=="healthy").slice(0,2).forEach(info=>{
  const overdue=info.risks.some(risk=>risk.includes("지났")||risk.includes("마감이 지난"));
  add(overdue?"project_deadline":"project_stalled",overdue?"important":"attention",overdue?"프로젝트 마감 주의":"프로젝트 활동 확인",`${info.project.name}: ${info.risks.join(" ")||"주의가 필요한 프로젝트입니다."}`,dayEnd,{type:"project",id:info.project.id},"projects");
 });
 if(input.monthlySummary&&input.date===input.monthlySummary.range.end&&!input.monthlySummary.records.monthlyReview)add("monthly_review","info","월간 리뷰","이번 달 월간 리뷰가 아직 작성되지 않았습니다.",dayEnd,undefined,"morning");
 return out.filter(r=>new Date(r.expiresAt).getTime()>now).sort((a,b)=>weight[b.severity]-weight[a.severity]||a.expiresAt.localeCompare(b.expiresAt));
}
