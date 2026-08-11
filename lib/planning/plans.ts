import type { Context, ContextFilterValue, Goal, Plan } from "./types";
export const getPlanForPeriod=(plans:Plan[],horizon:Plan["horizon"],start:string,contextId?:string)=>plans.find(p=>p.horizon===horizon&&p.periodStart===start&&(p.contextId??"")===(contextId??""));
export const getGoalsForPeriod=(goals:Goal[],horizon:Goal["horizon"],start:string)=>goals.filter(g=>g.horizon===horizon&&g.periodStart===start);
export const getChildGoals=(goals:Goal[],parentGoalId:string)=>goals.filter(g=>g.parentGoalId===parentGoalId);
export const getGoalsByContext=(goals:Goal[],contexts:Context[],filter:ContextFilterValue)=>filter==="ALL"?goals:goals.filter(g=>g.contextId===contexts.find(c=>c.key===filter)?.id);
export const getActiveGoals=(goals:Goal[])=>goals.filter(g=>g.status==="active");
