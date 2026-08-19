import type { Project, TaskItem } from "./types";

export type MorningBriefingEvent = { id: string; title: string; start: string; end: string; context?: string };
export type MorningBriefing = { date:string; direction:{goal:string;isComplete:boolean}; schedules:MorningBriefingEvent[]; todos:TaskItem[]; projects:Project[]; currentEvent?:MorningBriefingEvent; nextEvent?:MorningBriefingEvent; completedTodoCount:number; totalTodoCount:number; progress:number; priorities:string[]; warnings:string[]; message:string };
const time=(value:string)=>new Date(value).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"});
export function createMorningBriefing(input:{date:string;now:Date;direction:{morningDate:string;goal:string};schedules:MorningBriefingEvent[];todos:TaskItem[];projects:Project[]}):MorningBriefing{
 const schedules=[...input.schedules].sort((a,b)=>a.start.localeCompare(b.start));
 const todos=input.todos.filter(task=>task.bucket==="today"||task.scheduledAt?.slice(0,10)===input.date);
 const completedTodoCount=todos.filter(task=>task.done).length,totalTodoCount=todos.length,now=input.now.getTime();
 const currentEvent=schedules.find(event=>new Date(event.start).getTime()<=now&&new Date(event.end||event.start).getTime()>=now);
 const nextEvent=schedules.find(event=>new Date(event.start).getTime()>now);
 const isComplete=input.direction.morningDate===input.date&&Boolean(input.direction.goal.trim());
 const projects=input.projects.filter(project=>project.status==="active");
 const priorities=[...todos.filter(task=>!task.done).slice(0,3).map(task=>task.title),...projects.filter(project=>todos.some(task=>task.projectId===project.id)).slice(0,2).map(project=>project.name)].filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
 const warnings=[!isComplete?"오늘의 방향이 아직 기록되지 않았습니다.":"",!schedules.length?"오늘 일정이 없습니다.":"",!todos.length?"오늘 할 일이 없습니다.":"",nextEvent&&new Date(nextEvent.start).getTime()-now<3600000?`${time(nextEvent.start)} 일정이 임박했습니다.`:""].filter(Boolean);
 const message=`${isComplete?`오늘의 목표는 “${input.direction.goal.trim()}”입니다.`:"오늘의 방향이 아직 정해지지 않았습니다."} ${schedules.length?`오늘 일정은 ${schedules.length}개입니다.`:"오늘 일정은 없습니다."} ${todos.length?`할 일은 ${totalTodoCount}개 중 ${completedTodoCount}개 완료입니다.`:"오늘 할 일은 없습니다."} ${nextEvent?`다음 일정은 ${time(nextEvent.start)} ${nextEvent.title}입니다.`:"다음 일정은 없습니다."}`;
 return {date:input.date,direction:{goal:input.direction.goal,isComplete},schedules,todos,projects,currentEvent,nextEvent,completedTodoCount,totalTodoCount,progress:totalTodoCount?Math.round(completedTodoCount/totalTodoCount*100):0,priorities,warnings,message};
}
