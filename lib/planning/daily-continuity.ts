import type { Project, Review, TaskItem } from "./types";

export type CarryOverCandidate = {
  todoId: string; title: string; originalDate: string; currentDate?: string; contextId?: string; projectId?: string;
  dueDate?: string; carryCount: number; daysUnresolved: number; overdue: boolean;
};
export type DailyContinuity = {
  previousDate: string; previousIncompleteTodos: CarryOverCandidate[]; carryOverCandidates: CarryOverCandidate[];
  repeatedlyDeferred: CarryOverCandidate[]; overdue: CarryOverCandidate[]; stale: CarryOverCandidate[]; previousReview?: Review;
};
const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const dayDiff = (from: string, to: string) => Math.max(0, Math.round((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86400000));
export function previousDate(date: string) { const value=new Date(`${date}T12:00:00`); value.setDate(value.getDate()-1); return ymd(value); }
export function createDailyContinuity(input:{date:string;tasks:TaskItem[];reviews:Record<string,Review>;projects?:Project[]}):DailyContinuity {
 const previous=previousDate(input.date);
 const open=input.tasks.filter(task=>!task.done && Boolean(task.originalScheduledDate||task.carriedFrom||task.scheduledAt) && (task.originalScheduledDate||task.carriedFrom||task.scheduledAt).slice(0,10)<input.date);
 const map=(task:TaskItem):CarryOverCandidate=>{const original=(task.originalScheduledDate||task.carriedFrom||task.scheduledAt).slice(0,10);const carryHistory=task.carryHistory??(task.carriedFrom?[task.carriedFrom]:[]);return {todoId:task.id,title:task.title,originalDate:original,currentDate:task.scheduledAt?.slice(0,10),contextId:task.contextId,projectId:task.projectId,dueDate:task.dueDate,carryCount:carryHistory.length,daysUnresolved:dayDiff(original,input.date),overdue:Boolean(task.dueDate&&task.dueDate<input.date)};};
 const candidates=open.map(map);
 return {previousDate:previous,previousIncompleteTodos:candidates.filter(item=>item.currentDate===previous||item.originalDate===previous),carryOverCandidates:candidates,repeatedlyDeferred:candidates.filter(item=>item.carryCount>=3),overdue:candidates.filter(item=>item.overdue),stale:candidates.filter(item=>item.daysUnresolved>=7),previousReview:input.reviews[previous]};
}
export function carryTaskForward(task:TaskItem,date:string):TaskItem {
 const from=task.scheduledAt?.slice(0,10)||task.originalScheduledDate||date;
 if(task.done) return task;
 if(task.scheduledAt?.slice(0,10)===date && task.bucket==="today") return task;
  const scheduledAt=task.scheduledAt?.includes("T")?`${date}${task.scheduledAt.slice(10)}`:date;
 return {...task,bucket:"today",scheduledAt,originalScheduledDate:task.originalScheduledDate||from,carriedFrom:from,carryHistory:[...(task.carryHistory??[]),from]};
}
