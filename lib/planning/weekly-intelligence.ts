import type { Goal, Plan, Project, RecurringTaskCompletion, RecurringTaskDefinition, Review, TaskItem } from "./types";
import { getRoutineIntelligence, type RoutineIntelligence } from "./routine-intelligence";
import type { MorningBriefingEvent } from "./morning-briefing";
import { getWeekRange } from "./periods";

export type WeeklySummary = { start:string; end:string; goals:Goal[]; todo:{total:number;completed:number;incomplete:TaskItem[];carry:number;overdue:number}; calendar:{count:number;minutes:number;conflicts:number;busyDays:string[]}; projects:Array<{id:string;name:string;total:number;completed:number}>; records:{morning:number;evening:number}; routine:RoutineIntelligence; deferred:TaskItem[]; nextWeekCandidates:TaskItem[]; review?:Plan["weeklyReview"] };
const inRange=(value:string|undefined,start:string,end:string)=>Boolean(value&&value.slice(0,10)>=start&&value.slice(0,10)<=end);
export function getWeeklySummary(input:{weekStart:string;now?:Date;goals:Goal[];plans:Plan[];tasks:TaskItem[];events:MorningBriefingEvent[];projects:Project[];reviews:Record<string,Review>;recurringTasks?:RecurringTaskDefinition[];recurringTaskCompletions?:RecurringTaskCompletion[]}):WeeklySummary {
 const range=getWeekRange(input.weekStart), tasks=input.tasks.filter(task=>inRange(task.scheduledAt,range.start,range.end)||inRange(task.doneAt,range.start,range.end));
 const completed=tasks.filter(task=>task.done&&inRange(task.doneAt,range.start,range.end));
 const incomplete=tasks.filter(task=>!completed.some(done=>done.id===task.id)), events=input.events.filter(event=>inRange(event.start,range.start,range.end)).sort((a,b)=>a.start.localeCompare(b.start));
 const now=input.now??new Date();
 const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
 const overdueCutoff=today<range.start?today:today>range.end?range.end:today;
 const minutes=events.reduce((sum,event)=>sum+Math.max(0,(new Date(event.end).getTime()-new Date(event.start).getTime())/60000),0);
 const conflicts=events.reduce((state,event)=>{const start=new Date(event.start).getTime(),end=new Date(event.end).getTime();return {count:state.count+(state.latestEnd>start?1:0),latestEnd:Math.max(state.latestEnd,end)}},{count:0,latestEnd:Number.NEGATIVE_INFINITY}).count;
 const projectIds=[...new Set(tasks.map(task=>task.projectId).filter(Boolean))] as string[];
 const projects=projectIds.flatMap(id=>{const project=input.projects.find(item=>item.id===id);const linked=tasks.filter(task=>task.projectId===id);return project?[{id,name:project.name,total:linked.length,completed:linked.filter(task=>task.done&&inRange(task.doneAt,range.start,range.end)).length}]:[]});
 const reviewDays=Object.keys(input.reviews).filter(date=>date>=range.start&&date<=range.end);
 const plan=input.plans.find(item=>item.horizon==="WEEK"&&item.periodStart===range.start);
 const routine=getRoutineIntelligence({start:range.start,end:range.end,routines:input.recurringTasks,completions:input.recurringTaskCompletions,now});
 return {start:range.start,end:range.end,goals:input.goals.filter(goal=>goal.horizon==="WEEK"&&goal.periodStart===range.start),todo:{total:tasks.length,completed:completed.length,incomplete,carry:incomplete.filter(task=>(task.carryHistory?.length??0)>0).length,overdue:incomplete.filter(task=>Boolean(task.dueDate&&task.dueDate.slice(0,10)<overdueCutoff)).length},calendar:{count:events.length,minutes,conflicts,busyDays:[...new Set(events.map(event=>event.start.slice(0,10)))].sort((a,b)=>events.filter(event=>event.start.slice(0,10)===b).length-events.filter(event=>event.start.slice(0,10)===a).length).slice(0,2)},projects,records:{morning:input.goals.filter(goal=>goal.horizon==="DAY"&&goal.periodStart>=range.start&&goal.periodStart<=range.end).length,evening:reviewDays.length},routine,deferred:incomplete.filter(task=>(task.carryHistory?.length??0)>=2),nextWeekCandidates:incomplete,review:plan?.weeklyReview};
}
