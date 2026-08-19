"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ReviewGratitude } from "@/components/review-gratitude";
import { JeongShellNavigation } from "@/components/jeong-shell";
import { JeongHero } from "@/components/jeong-hero";
import reviewStyles from "@/components/jeong-review.module.css";
import themeStyles from "@/components/jeong-theme.module.css";
import homeStyles from "@/components/home-dashboard.module.css";
import { HomeHero } from "@/components/home-hero";
import { ContextFilter } from "@/components/planning/context-filter";
import { ContextPicker, ContextTag } from "@/components/planning/context-picker";
import { PlanningWorkspace } from "@/components/planning/planning-workspace";
import { HomeOperations, HomeProjectSummary } from "@/components/planning/home-operations";
import planningContextStyles from "@/components/planning/planning-context.module.css";
import {
  loadLocalState,
  normalizeLocalState,
  saveLocalState,
} from "@/lib/planning/local-state-repository";
import {
  DEFAULT_CONTEXTS,
  calendarEventContextKey,
  filterCalendarEventsByContext,
  filterTasksByContext,
  getCalendarContextId,
  getDefaultCalendarId,
  getEventContextId,
} from "@/lib/planning/contexts";
import { usePlanningContextFilter } from "@/lib/planning/use-planning-context-filter";
import {
  describeRecurrence,
  recurrenceToGoogleRrule,
  getOccurrencesForDate,
} from "@/lib/planning/recurrence";
import { getMonthRange, getNextMonth, getNextWeek, getPreviousMonth, getPreviousWeek, getWeekRange } from "@/lib/planning/periods";
import { formatProjectPeriod, getProjectDday, withProjectStatus } from "@/lib/planning/projects";
import { getDailyHomeSummary } from "@/lib/planning/home-summary";
import { createMorningBriefing } from "@/lib/planning/morning-briefing";
import { createProactiveReminders } from "@/lib/planning/proactive-reminders";
import { getDailyRecord } from "@/lib/planning/daily-record";
import { carryTaskForward, createDailyContinuity } from "@/lib/planning/daily-continuity";
import { getWeeklySummary } from "@/lib/planning/weekly-intelligence";
import { getMonthlySummary } from "@/lib/planning/monthly-intelligence";
import { getProjectIntelligence } from "@/lib/planning/project-intelligence";
import { getPersonalIntelligence } from "@/lib/planning/personal-intelligence";
import { buildChatGptLifeStatePrompt, type AiPromptType } from "@/lib/planning/chatgpt-life-state";
import { getOperatingContext } from "@/lib/planning/operating-loop";
import type {
  Activity,
  ActivityType,
  LocalState,
  Goal,
  Plan,
  Note,
  NoteType,
  Person,
  Project,
  RecurringTaskCompletion,
  RecurringTaskDefinition,
  Review,
  TaskBucket,
  TaskItem,
  ContextFilterValue,
} from "@/lib/planning/types";

type View = "home"|"day"|"weekly-plan"|"monthly-plan"|"calendar"|"routines"|"projects"|"people"|"records"|"analytics"|"activities"|"notes"|"review"|"timeline"|"chapters"|"ai"|"settings"|"profile";
const VALID_VIEWS = new Set<View>(["home","day","weekly-plan","monthly-plan","calendar","routines","projects","people","records","analytics","activities","notes","review","timeline","chapters","ai","settings","profile"]);
type CalendarMode = "month"|"week"|"day";
type MonthDisplayMode = "calendar" | "list";
type PeopleViewFilter = "all" | "due" | "waiting" | "stale";
type Recurrence = "none"|"daily"|"weekdays"|"weekly"|"biweekly"|"monthly"|"yearly"|"custom";
type ToastState={message:string;kind:"success"|"info"|"error"}|null;
type WeatherInfo={temperature:number;apparent:number;code:number;wind:number;location:string}|null;
type ProjectDialogMode="project"|"milestone"|null;
type TimelineItem={date:string;kind:string;title:string;note:string;project?:string};
type DashboardUser={name?:string|null;email?:string|null;image?:string|null};

type EventItem = {
 id:string; title:string; start:string; end:string; location:string; description:string;
 recurrence?:string[]; reminders?:number[]; useDefaultReminders?:boolean; htmlLink?:string; allDay?:boolean;
 attendees?:string[]; colorId?:string; visibility?:string; transparency?:string;
 hangoutLink?:string; recurringEventId?:string; originalStart?:string;
 calendarId?:string; calendarName?:string; contextId?:string; updated?:string;
};
type DeletedEventTombstone = {
 calendarId:string; id:string; seriesId?:string; scope:"single"|"future"|"series"; from?:string; expiresAt:number;
};

type EventForm = {
 id?:string; seriesId?:string; title:string; start:string; end:string; allDay:boolean;
 location:string; description:string; recurrence:Recurrence; recurrenceUntil:string;
 recurrenceCount:number; recurrenceInterval:number; weeklyDays:string[];
 monthlyMode:"date"|"lastDay"|"nthWeekday"|"lastWeekday";
 holidayPolicy:"skip"|"next"|"previous";
 excludeHolidays:boolean; excludeWeekends:boolean; reminders:number[]; useDefaultReminders:boolean;
 attendees:string; addMeet:boolean; visibility:"default"|"public"|"private";
 transparency:"opaque"|"transparent"; colorId:string;
 editScope:"single"|"future"|"series"; calendarId:string;
 contextId?:string;
};

const DAILY_CONTENT_DATE_KEY="jeong_daily_content_date";
const todayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const uid=()=>crypto.randomUUID?.()??`${Date.now()}-${Math.random()}`;
const toLocalInput=(value?:string)=>{const d=value?new Date(value):new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const eventTime=(v:string)=>{const d=new Date(v); return Number.isNaN(d.getTime())||!v.includes("T")?"종일":d.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})};
const eventTime24=(v:string)=>{const d=new Date(v);return Number.isNaN(d.getTime())||!v.includes("T")?"종일":`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
const eventDateKey=(v:string)=>v.includes("T")?todayKey(new Date(v)):v.slice(0,10);
const dateInput=(v?:string)=>v?eventDateKey(v):todayKey();
const parseYmd=(value:string)=>{const [y,m,d]=value.slice(0,10).split("-").map(Number);return new Date(y,m-1,d)};
const formatYmd=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const addDaysYmd=(value:string,days:number)=>{const d=parseYmd(value);d.setDate(d.getDate()+days);return formatYmd(d)};
const taskPeriodForBucket=(bucket:TaskBucket,start=todayKey())=>{
 if(bucket==="today")return {start,end:start};
 if(bucket==="week")return {start,end:getWeekRange(start).end};
 if(bucket==="month")return {start,end:getMonthRange(start).end};
 return {start:"",end:""};
};
const compactYmd=(value:string)=>value.slice(0,10).replaceAll("-","");
const localTimeParts=(value:string)=>{const d=new Date(value);return `${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}${String(d.getSeconds()).padStart(2,"0")}`};
const contextEventColorId=(contextId?:string)=>contextId==="personal"?"5":contextId==="work"?"9":contextId==="church"?"3":"";
const contextTone=(contextId?:string)=>contextId==="work"?"work":contextId==="church"?"church":contextId==="personal"?"personal":"unassigned";
function groupTimeline(items:TimelineItem[]){
 const grouped:Record<string,Record<string,TimelineItem[]>>={};
 for(const item of items){const year=item.date.slice(0,4)||"기타";const month=item.date.slice(0,7)||year;grouped[year]??={};grouped[year][month]??=[];grouped[year][month].push(item)}
 return Object.entries(grouped).sort(([a],[b])=>b.localeCompare(a)).map(([year,months])=>({year,months:Object.entries(months).sort(([a],[b])=>b.localeCompare(a)).map(([month,entries])=>({month,entries}))}));
}

const projectStatusLabel:Record<Project["status"],string>={planning:"기획",active:"진행 중",review:"검토 중",done:"완료"};
const activityLabels:Record<ActivityType,string>={running:"러닝",workout:"근력 운동",martial:"무도",reading:"독서",study:"공부",church:"교회·교육",photo:"사진",other:"기타"};
const noteLabels:Record<NoteType,string>={idea:"아이디어",thought:"생각",question:"질문",principle:"기준",quote:"어록"};
const bucketLabels:Record<TaskBucket,string>={today:"오늘",week:"이번 주",month:"이번 달",someday:"언젠가"};
const defaultProjects:Project[]=[];
const defaultState:LocalState={
 schemaVersion:3,morningDate:"",goal:"",reason:"",enjoyment:"",gratitude:["","",""] ,tasks:[],people:[],projects:defaultProjects,activities:[],notes:[],reviews:{},chapters:[],contexts:DEFAULT_CONTEXTS,calendarContextMappings:[],contextCalendarPreferences:[],calendarEventContextOverrides:[],recurringTasks:[],recurringTaskCompletions:[],plans:[],goals:[],personalInsightPreferences:[],operatingReminderPreferences:[]
};
function monthDays(cursor:Date){const first=new Date(cursor.getFullYear(),cursor.getMonth(),1); const start=new Date(cursor.getFullYear(),cursor.getMonth(),1-first.getDay()); return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})}
function rangeFor(mode:CalendarMode,cursor:Date){if(mode==="month"){const days=monthDays(cursor);const start=new Date(days[0]);start.setHours(0,0,0,0);const end=new Date(days[days.length-1]);end.setDate(end.getDate()+1);end.setHours(0,0,0,0);return {start,end}}; if(mode==="week"){const s=new Date(cursor);s.setDate(s.getDate()-((s.getDay()+6)%7));s.setHours(0,0,0,0);const e=new Date(s);e.setDate(e.getDate()+7);return {start:s,end:e}} const s=new Date(cursor);s.setHours(0,0,0,0);const e=new Date(s);e.setDate(e.getDate()+1);return {start:s,end:e}}
function gratitudeArray(value:unknown){
 if(Array.isArray(value))return [0,1,2].map(i=>String(value[i]??""));
 if(typeof value==="string"&&value.trim())return value.split(/\s*\/\s*|\n+/).slice(0,3).concat(["", "", ""]).slice(0,3);
 return ["","",""];
}
function emptyReview(date:string,state:LocalState):Review{return {
 date,
 goal:date===todayKey()?state.goal:"",
 enjoyment:date===todayKey()?state.enjoyment:"",
 status:"",
 reason:"",
 good:"",
 learned:"",
 joy:"",
 gratitude:"",
 morningGratitude:date===todayKey()?gratitudeArray(state.gratitude):["","",""],
 eveningGratitude:["","",""]
}}

function EventDateTimeField({label,value,allDay,onChange}:{label:string;value:string;allDay:boolean;onChange:(value:string)=>void}){
 const date=dateInput(value);
 const matched=value.match(/T(\d{2}):(\d{2})/);
 const hour24=matched?Number(matched[1]):9;
 const minute=matched?Number(matched[2]):0;
 const period=hour24>=12?"PM":"AM";
 const hour12=hour24%12||12;
 const [hourDraft,setHourDraft]=useState(String(hour12));
 const [minuteDraft,setMinuteDraft]=useState(String(minute).padStart(2,"0"));
 useEffect(()=>{
  setHourDraft(String(hour12));
  setMinuteDraft(String(minute).padStart(2,"0"));
 },[hour12,minute,value]);
 const compose=(nextDate=date,nextPeriod=period,nextHour=hour12,nextMinute=minute)=>{
  if(allDay){onChange(nextDate);return;}
  const safeHour=Math.min(12,Math.max(1,Number.isFinite(nextHour)?nextHour:hour12));
  const safeMinute=Math.min(59,Math.max(0,Number.isFinite(nextMinute)?nextMinute:minute));
  const baseHour=safeHour%12+(nextPeriod==="PM"?12:0);
  onChange(`${nextDate}T${String(baseHour).padStart(2,"0")}:${String(safeMinute).padStart(2,"0")}`);
 };
 const commitHour=()=>{
  const raw=Number(hourDraft);
  const next=hourDraft.trim()&&Number.isFinite(raw)?Math.min(12,Math.max(1,raw)):hour12;
  setHourDraft(String(next));
  compose(date,period,next,minute);
 };
 const commitMinute=()=>{
  const raw=Number(minuteDraft);
  const next=minuteDraft.trim()&&Number.isFinite(raw)?Math.min(59,Math.max(0,raw)):minute;
  setMinuteDraft(String(next).padStart(2,"0"));
  compose(date,period,hour12,next);
 };
 return <label className="eventDateTimeControl"><span>{label}</span><div className="eventDateTimeInner">
  <input className="eventDateOnly" type="date" value={date} onChange={event=>compose(event.target.value)}/>
  {!allDay&&<div className="eventTimeSelects">
   <select aria-label={`${label} 오전 오후`} value={period} onChange={event=>compose(date,event.target.value as "AM"|"PM",hour12,minute)}><option value="AM">오전</option><option value="PM">오후</option></select>
   <input className="eventTimeNumber" aria-label={`${label} 시`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={hourDraft} onFocus={event=>event.currentTarget.select()} onChange={event=>setHourDraft(event.target.value.replace(/\D/g,"").slice(0,2))} onBlur={commitHour} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur()}}/>
   <span className="eventTimeColon">:</span>
   <input className="eventTimeNumber" aria-label={`${label} 분`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={minuteDraft} onFocus={event=>event.currentTarget.select()} onChange={event=>setMinuteDraft(event.target.value.replace(/\D/g,"").slice(0,2))} onBlur={commitMinute} onKeyDown={event=>{if(event.key==="Enter")event.currentTarget.blur()}}/>
  </div>}
 </div></label>;
}
function eventOccursOnDate(e:EventItem,date:string){
 const dayStart=parseYmd(date);
 const dayEnd=new Date(dayStart);
 dayEnd.setDate(dayEnd.getDate()+1);

 // Google Calendar의 종일 일정 종료일은 포함되지 않는 날짜(exclusive)입니다.
 if(e.allDay||!e.start.includes("T")){
  const startDate=parseYmd(eventDateKey(e.start));
  const rawEnd=e.end?parseYmd(eventDateKey(e.end)):new Date(startDate);
  const endDate=new Date(rawEnd);
  // Calendar API normalizes all-day end to an inclusive date for JEONG editing.
  endDate.setDate(endDate.getDate()+1);
  return startDate.getTime()<dayEnd.getTime()&&endDate.getTime()>dayStart.getTime();
 }

 // 시간 일정은 해당 날짜 구간과 실제로 겹칠 때만 표시합니다.
 // 전날 23:00~오늘 00:00처럼 오늘 0시에 끝난 일정은 오늘 일정에서 제외됩니다.
 const startTime=new Date(e.start).getTime();
 const parsedEnd=e.end?new Date(e.end).getTime():startTime;
 const endTime=Number.isFinite(parsedEnd)&&parsedEnd>startTime?parsedEnd:startTime+1;
 return startTime<dayEnd.getTime()&&endTime>dayStart.getTime();
}
function eventStatus(e:EventItem){
 if(e.allDay){const today=todayKey(),start=eventDateKey(e.start),end=eventDateKey(e.end||e.start);if(today>end)return "완료";if(today>=start)return "진행 중";return "예정"}
 const n=Date.now(),start=new Date(e.start).getTime(),end=new Date(e.end).getTime();if(n>=end)return "완료";if(n>=start)return "진행 중";return "예정"
}
function recurrenceRule(form:EventForm){
 if(form.recurrence==="none")return "";
 const d=new Date(form.start);
 const defaultDay=["SU","MO","TU","WE","TH","FR","SA"][d.getDay()];
 const selectedDays=form.weeklyDays.length?form.weeklyDays.join(","):defaultDay;
 const interval=Math.max(1,form.recurrenceInterval||1);
 let rule="RRULE:";
 if(form.recurrence==="daily")rule+=`FREQ=DAILY;INTERVAL=${interval}`;
 else if(form.recurrence==="weekdays")rule+=`FREQ=WEEKLY;INTERVAL=${interval};BYDAY=MO,TU,WE,TH,FR`;
 else if(form.recurrence==="weekly")rule+=`FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${selectedDays}`;
 else if(form.recurrence==="biweekly")rule+=`FREQ=WEEKLY;INTERVAL=${Math.max(2,interval)};BYDAY=${selectedDays}`;
 else if(form.recurrence==="monthly"){
  if(form.monthlyMode==="lastDay")rule+=`FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=-1`;
  else if(form.monthlyMode==="nthWeekday"){const nth=Math.ceil(d.getDate()/7);rule+=`FREQ=MONTHLY;INTERVAL=${interval};BYDAY=${nth}${defaultDay}`;}
  else if(form.monthlyMode==="lastWeekday")rule+=`FREQ=MONTHLY;INTERVAL=${interval};BYDAY=-1${defaultDay}`;
  else rule+=`FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${d.getDate()}`;
 }
 else if(form.recurrence==="yearly")rule+=`FREQ=YEARLY;INTERVAL=${interval};BYMONTH=${d.getMonth()+1};BYMONTHDAY=${d.getDate()}`;
 else rule+=`FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${selectedDays}`;
 if(form.recurrenceCount>0)rule+=`;COUNT=${form.recurrenceCount}`;
 else if(form.recurrenceUntil)rule+=`;UNTIL=${form.recurrenceUntil.replaceAll("-","")}T235959Z`;
 return rule;
}

export function Dashboard({user}: {user?:DashboardUser}){
 const [local,setLocal]=useState<LocalState>(defaultState); const [hydrated,setHydrated]=useState(false); const [theme,setTheme]=useState<"light"|"dark">("light");
 const [view,setView]=useState<View>("home"); const viewRef=useRef<View>("home"); const historyReadyRef=useRef(false); const [search,setSearch]=useState(""); const [showMorning,setShowMorning]=useState(false);
 const [dayExecutionMode,setDayExecutionMode]=useState<"todos"|"routines">("todos"); const [dayExecutionContext,setDayExecutionContext]=useState<ContextFilterValue>("ALL");
 const [events,setEvents]=useState<EventItem[]>([]); const [operationalEvents,setOperationalEvents]=useState<EventItem[]>([]); const deletedEventTombstones=useRef<DeletedEventTombstone[]>([]); const [loading,setLoading]=useState(false); const [calendarError,setCalendarError]=useState(""); const [operationalCalendarError,setOperationalCalendarError]=useState(""); const [calendarReady,setCalendarReady]=useState(false);
 const [calendarMode,setCalendarModeState]=useState<CalendarMode>("month"); const [cursor,setCursor]=useState(new Date()); const [selectedDate,setSelectedDate]=useState(new Date()); const [calendarTaskRange,setCalendarTaskRange]=useState<"day"|"week"|"month">("day"); const [calendarDayPreview,setCalendarDayPreview]=useState<Date|null>(null); const [eventReturnDate,setEventReturnDate]=useState<Date|null>(null); const [eventForm,setEventForm]=useState<EventForm|null>(null);
 const [monthDisplay,setMonthDisplay]=useState<MonthDisplayMode>("calendar"); const [weekDisplay,setWeekDisplay]=useState<"calendar"|"list">("calendar"); const [monthSearch,setMonthSearch]=useState(""); const [monthStatus,setMonthStatus]=useState<"all"|"planned"|"doing"|"done">("all");
 const setCalendarMode=(mode:CalendarMode)=>setCalendarModeState(mode);
 const [calendarOptions,setCalendarOptions]=useState<{id:string;name:string;primary:boolean;color?:string}[]>([]);
 const [visibleCalendarIds,setVisibleCalendarIds]=useState<string[]>(["primary"]);
 const [taskTitle,setTaskTitle]=useState(""); const [taskMemo,setTaskMemo]=useState("");
 const [taskRepeatBlocks,setTaskRepeatBlocks]=useState([{startDay:1,endDay:3,target:1},{startDay:4,endDay:0,target:1}]);
 const [taskRepeatMode,setTaskRepeatMode]=useState<"DAILY"|"WEEKDAYS"|"WEEKENDS"|"WEEKLY"|"BIWEEKLY"|"WEEKLY_BLOCKS"|"MONTHLY">("WEEKLY");
 const [taskRepeatWeekdays,setTaskRepeatWeekdays]=useState<number[]>([new Date().getDay()]);
 const [taskContext,setTaskContext]=useState<string>("personal");
 const [routineSection,setRoutineSection]=useState<"daily"|"weekly">("daily");
 const [editingRecurringId,setEditingRecurringId]=useState<string|null>(null);
 const [draggingRecurringId,setDraggingRecurringId]=useState<string|null>(null);
 const [draggingMilestoneId,setDraggingMilestoneId]=useState<string|null>(null);
 const [selectedProject,setSelectedProject]=useState<string>(""); const [projectEditing,setProjectEditing]=useState(false); const [personName,setPersonName]=useState(""); const [personTag,setPersonTag]=useState("보험");
 const [peopleFilter,setPeopleFilter]=useState<PeopleViewFilter>("all"); const [peopleSearch,setPeopleSearch]=useState(""); const [contactsImporting,setContactsImporting]=useState(false);
 const [activityType,setActivityType]=useState<ActivityType>("running"); const [activityTitle,setActivityTitle]=useState(""); const [activityDate,setActivityDate]=useState(todayKey()); const [activityDuration,setActivityDuration]=useState(60); const [activityAmount,setActivityAmount]=useState(0); const [activityNote,setActivityNote]=useState(""); const [activityLearned,setActivityLearned]=useState(""); const [activityApplied,setActivityApplied]=useState("");
 const [noteType,setNoteType]=useState<NoteType>("idea"); const [noteTitle,setNoteTitle]=useState(""); const [noteBody,setNoteBody]=useState(""); const [reviewDate,setReviewDate]=useState(todayKey());
 const [recordFilter,setRecordFilter]=useState<"all"|"activity"|"note"|"review">("all");
 const [chapterTitle,setChapterTitle]=useState(""); const [chapterDescription,setChapterDescription]=useState("");
 const [dayDate,setDayDate]=useState(todayKey());
 const [editingTask,setEditingTask]=useState<TaskItem|null>(null);
 const [editingActivity,setEditingActivity]=useState<Activity|null>(null);
 const [editingNote,setEditingNote]=useState<Note|null>(null);
 const [editingPerson,setEditingPerson]=useState<Person|null>(null);
 const [contactChannel,setContactChannel]=useState("문자");
 const [contactSummary,setContactSummary]=useState("");
 const [taskProject,setTaskProject]=useState("");
 const [activityProject,setActivityProject]=useState("");
 const [noteProject,setNoteProject]=useState("");
 const [aiType,setAiType]=useState<AiPromptType>("daily");

 const [aiIncludePeople,setAiIncludePeople]=useState(false);

 const [toast,setToast]=useState<ToastState>(null);
 const [savingEvent,setSavingEvent]=useState(false);
 const [searchOpen,setSearchOpen]=useState(false);
 const [now,setNow]=useState(new Date());
 const [weather,setWeather]=useState<WeatherInfo>(null);
 const [weatherLoading,setWeatherLoading]=useState(true);
 const [projectDialog,setProjectDialog]=useState<ProjectDialogMode>(null);
 const [previousView,setPreviousView]=useState<View>("records");
 const [pageLoading,setPageLoading]=useState(false);
 const [newProjectName,setNewProjectName]=useState("");
 const [newProjectGoal,setNewProjectGoal]=useState("");
 const [newProjectStartDate,setNewProjectStartDate]=useState("");
 const [newProjectDueDate,setNewProjectDueDate]=useState("");
 const [projectRoutineTitle,setProjectRoutineTitle]=useState("");
 const [projectRoutineMode,setProjectRoutineMode]=useState<"DAILY"|"WEEKDAYS"|"WEEKENDS"|"WEEKLY"|"BIWEEKLY">("DAILY");
 const [projectRoutineMilestone,setProjectRoutineMilestone]=useState("");
 const [newMilestoneTitle,setNewMilestoneTitle]=useState("");
 const [newMilestoneWeight,setNewMilestoneWeight]=useState(25);
 const [newMilestoneStartDate,setNewMilestoneStartDate]=useState("");
 const [newMilestoneDueDate,setNewMilestoneDueDate]=useState("");
 const [newMilestoneRoutineIds,setNewMilestoneRoutineIds]=useState<string[]>([]);
 const [contextFilter,setContextFilter]=usePlanningContextFilter();
 const [planningAnchor,setPlanningAnchor]=useState(todayKey());
 useEffect(()=>{if(view!=="weekly-plan"&&view!=="monthly-plan")return;const next=new Date(`${planningAnchor}T12:00:00`);setCursor(next);setCalendarMode(view==="monthly-plan"?"month":"week")},[view,planningAnchor]);
 useEffect(()=>{if(hydrated&&view==="home")setContextFilter("ALL")},[view,hydrated]);

 useEffect(()=>{const s=loadLocalState({defaultState,noteLabels});setLocal(s);setShowMorning(s.morningDate!==todayKey());const t=(localStorage.getItem("jeong_theme") as "light"|"dark"|null)??"light";setTheme(t);document.documentElement.dataset.theme=t;
 const savedCalendars=localStorage.getItem("jeong_visible_calendars");if(savedCalendars){try{setVisibleCalendarIds(JSON.parse(savedCalendars))}catch{}}
 const requestedView=new URLSearchParams(window.location.search).get("view") as View|null;if(requestedView&&VALID_VIEWS.has(requestedView))setView(requestedView);
 setHydrated(true)},[]);
 useEffect(()=>{if(hydrated)saveLocalState(local)},[local,hydrated]);
 useEffect(()=>{
  const timer=window.setInterval(()=>setNow(new Date()),30000);
  return()=>window.clearInterval(timer);
 },[]);
 useEffect(()=>{
  const rootEl=document.documentElement;
  const update=(event:PointerEvent)=>{
   const x=(event.clientX/window.innerWidth-.5);
   const y=(event.clientY/window.innerHeight-.5);
   rootEl.style.setProperty("--jeong-mx",x.toFixed(4));
   rootEl.style.setProperty("--jeong-my",y.toFixed(4));
  };
  window.addEventListener("pointermove",update,{passive:true});
  return()=>window.removeEventListener("pointermove",update);
 },[]);
 const hasBlockingOverlay=showMorning||Boolean(calendarDayPreview)||Boolean(eventForm)||Boolean(editingTask)||Boolean(editingActivity)||Boolean(editingNote)||Boolean(editingPerson)||searchOpen||Boolean(projectDialog);
 useEffect(()=>{
  if(!hasBlockingOverlay)return;
  const body=document.body;
  const scrollY=window.scrollY;
  const previous={position:body.style.position,top:body.style.top,left:body.style.left,right:body.style.right,width:body.style.width,overflowY:body.style.overflowY};
  body.style.position="fixed";
  body.style.top=`-${scrollY}px`;
  body.style.left="0";
  body.style.right="0";
  body.style.width="100%";
  body.style.overflowY="scroll";
  return()=>{
   body.style.position=previous.position;
   body.style.top=previous.top;
   body.style.left=previous.left;
   body.style.right=previous.right;
   body.style.width=previous.width;
   body.style.overflowY=previous.overflowY;
   window.scrollTo(0,scrollY);
  };
 },[hasBlockingOverlay]);
 useEffect(()=>{
  if(!hydrated)return;
  const current=todayKey();
  const last=localStorage.getItem(DAILY_CONTENT_DATE_KEY)||localStorage.getItem("jeong_last_active_date")||current;
  if(last===current)return;
  setLocal(prev=>{
   const reviews={...prev.reviews};
   if(prev.goal||prev.enjoyment||prev.gratitude.some(Boolean)){
    reviews[last]={
    ...(reviews[last]??emptyReview(last,prev)),
    date:last,
    goal:prev.goal,
    enjoyment:prev.enjoyment,
    gratitude:prev.gratitude.filter(Boolean).join(" / "),
    morningGratitude:gratitudeArray(prev.gratitude),
    eveningGratitude:gratitudeArray((reviews[last] as Review|undefined)?.eveningGratitude)
   };
   }
   return {...prev,morningDate:"",goal:"",reason:"",enjoyment:"",gratitude:["","",""],dailyGoalId:undefined,parentWeeklyGoalId:undefined,reviews,tasks:prev.tasks.map(t=>t.done&&!t.doneAt?{...t,doneAt:last}:t)};
  });
  localStorage.setItem(DAILY_CONTENT_DATE_KEY,current);
  localStorage.setItem("jeong_last_active_date",current);
  setShowMorning(true);
 },[now,hydrated]);
 useEffect(()=>{requestWeather()},[]);

 const update=<K extends keyof LocalState>(key:K,value:LocalState[K])=>setLocal(s=>({...s,[key]:value}));
 const toggleTheme=()=>{const n=theme==="light"?"dark":"light";setTheme(n);localStorage.setItem("jeong_theme",n);document.documentElement.dataset.theme=n};
 const tombstoneMatches=(event:EventItem,tombstone:DeletedEventTombstone)=>{
  if(tombstone.calendarId&&event.calendarId&&tombstone.calendarId!==event.calendarId&&tombstone.calendarId!=="primary"&&event.calendarId!=="primary")return false;
  if(tombstone.scope==="single")return event.id===tombstone.id;
  const seriesId=tombstone.seriesId||tombstone.id;
  if(event.id===seriesId)return true;
  if(event.recurringEventId!==seriesId)return false;
  if(tombstone.scope==="series")return true;
  const eventStart=new Date(event.start).getTime();const from=new Date(tombstone.from||"").getTime();
  return Number.isFinite(eventStart)&&Number.isFinite(from)&&eventStart>=from;
 };
 const applyDeletionTombstones=(items:EventItem[])=>{
  const nowMs=Date.now();
  deletedEventTombstones.current=deletedEventTombstones.current.filter(item=>item.expiresAt>nowMs);
  return items.filter(event=>!deletedEventTombstones.current.some(tombstone=>tombstoneMatches(event,tombstone)));
 };
 const dedupeCalendarEvents=(items:EventItem[])=>{
  const deduped=new Map<string,EventItem>();
  for(const event of items){
   const key=`${event.calendarId||"primary"}::${event.id}`;
   const current=deduped.get(key);
   if(!current||String(event.updated||"").localeCompare(String(current.updated||""))>=0)deduped.set(key,event);
  }
  return [...deduped.values()].sort((a,b)=>String(a.start).localeCompare(String(b.start)));
 };
 const replaceEditedEvent=(items:EventItem[],source:EventItem,saved:EventItem)=>{
  const calendarId=saved.calendarId||source.calendarId||"primary";
  const next=items.filter(event=>!(event.id===source.id&&(event.calendarId||"primary")===calendarId));
  return dedupeCalendarEvents([...next,{...saved,calendarId}]);
 };

 async function loadCalendar(){
 setLoading(true);setCalendarError("");
 const r=rangeFor(calendarMode,cursor);
 const q=new URLSearchParams({start:r.start.toISOString(),end:r.end.toISOString(),calendarIds:visibleCalendarIds.join(",")});
 try{
  const [cr,lr]=await Promise.all([
   fetch(`/api/calendar?${q}`,{cache:"no-store"}),
   fetch("/api/calendar/calendars",{cache:"no-store"})
  ]);
  const calendarEvents=cr.ok?((await cr.json()).events??[]):null;
  if(!cr.ok)setCalendarError("Google Calendar를 불러오지 못했습니다.");
  if(lr.ok){
   const list=(await lr.json()).calendars??[];
   const primaryId=list.find((calendar:any)=>calendar.primary)?.id;
   setCalendarOptions(list);
   if(calendarEvents)setEvents(applyDeletionTombstones(dedupeCalendarEvents(calendarEvents.map((event:EventItem)=>event.calendarId==="primary"&&primaryId?{...event,calendarId:primaryId}:event))));
   if(!visibleCalendarIds.length&&list.length)setVisibleCalendarIds(list.filter((x:any)=>x.primary).map((x:any)=>x.id));
  }else if(calendarEvents)setEvents(applyDeletionTombstones(dedupeCalendarEvents(calendarEvents)));
 }catch{
  setCalendarError("Google Calendar를 불러오지 못했습니다.");
 }finally{setLoading(false)}
}
 async function loadOperationalCalendar(){
  setCalendarReady(false);setOperationalCalendarError("");
  const start=new Date();start.setDate(start.getDate()-93);start.setHours(0,0,0,0);
  const end=new Date();end.setDate(end.getDate()+45);end.setHours(23,59,59,999);
  const q=new URLSearchParams({start:start.toISOString(),end:end.toISOString(),calendarIds:visibleCalendarIds.join(",")});
  try{
   const response=await fetch(`/api/calendar?${q}`,{cache:"no-store"});
   if(!response.ok)throw new Error("calendar");
   const data=await response.json();
   const primaryId=calendarOptions.find(calendar=>calendar.primary)?.id;
   setOperationalEvents(applyDeletionTombstones(dedupeCalendarEvents(((data.events??[]) as EventItem[]).map(event=>event.calendarId==="primary"&&primaryId?{...event,calendarId:primaryId}:event))));
  }catch{
   setOperationalEvents([]);
   setOperationalCalendarError("Google Calendar 운영 데이터를 불러오지 못했습니다.");
  }finally{
   setCalendarReady(true);
  }
 }
 async function refreshCalendarData(){await Promise.all([loadCalendar(),loadOperationalCalendar()])}
 useEffect(()=>{if(hydrated)loadCalendar()},[hydrated,calendarMode,cursor,visibleCalendarIds.join("|")]);
 useEffect(()=>{if(hydrated)loadOperationalCalendar()},[hydrated,visibleCalendarIds.join("|")]);
 useEffect(()=>{if(hydrated)localStorage.setItem("jeong_visible_calendars",JSON.stringify(visibleCalendarIds))},[visibleCalendarIds,hydrated]);

 const rawCurrentReview=local.reviews[reviewDate];
 const currentReview:Review={
  ...emptyReview(reviewDate,local),
  ...rawCurrentReview,
  morningGratitude:gratitudeArray(rawCurrentReview?.morningGratitude??rawCurrentReview?.gratitude??(reviewDate===todayKey()?local.gratitude:[])),
  eveningGratitude:gratitudeArray(rawCurrentReview?.eveningGratitude)
 };
 const updateReview=(patch:Partial<Review>)=>setLocal(s=>({...s,reviews:{...s.reviews,[reviewDate]:{...(s.reviews[reviewDate]??emptyReview(reviewDate,s)),...patch,date:reviewDate}}}));
 const contextEvents=filterCalendarEventsByContext(events,local.calendarContextMappings,local.contexts,contextFilter,local.calendarEventContextOverrides??[]);
 const operationalContextEvents=filterCalendarEventsByContext(operationalEvents,local.calendarContextMappings,local.contexts,contextFilter,local.calendarEventContextOverrides??[]);
 const eventContextId=(event:{id?:string;recurringEventId?:string;calendarId?:string;contextId?:string;colorId?:string})=>getEventContextId(local.calendarEventContextOverrides??[],local.calendarContextMappings,event);
 const eventTone=(event:EventItem)=>contextTone(eventContextId(event));
 const contextTasks=filterTasksByContext(local.tasks,local.contexts,contextFilter);
 const currentDateKey=todayKey(now);
 const todayEvents=operationalContextEvents.filter(e=>eventOccursOnDate(e,todayKey()));
 const selectedDateKey=todayKey(calendarMode==="day"?cursor:selectedDate);
 const calendarPanelDate=parseYmd(currentDateKey);
 const calendarTodoDateKey=currentDateKey;
 // The Calendar date controls schedules only. The right Todo rail always stays on today.
 const selectedDayTasks=contextTasks.filter(task=>{
  const scheduledDate=task.scheduledAt?.slice(0,10);
  if(scheduledDate)return scheduledDate===calendarTodoDateKey;
  return task.bucket==="today"&&(!task.done||task.doneAt===calendarTodoDateKey);
 }).sort((a,b)=>Number(a.done)-Number(b.done)||(a.sortOrder??Number.MAX_SAFE_INTEGER)-(b.sortOrder??Number.MAX_SAFE_INTEGER)||(a.scheduledAt||"").localeCompare(b.scheduledAt||""));
 const selectedDayTaskIds=new Set(selectedDayTasks.map(task=>task.id));
 const isCurrentOrFutureTask=(task:TaskItem)=>!task.done&&(!task.scheduledAt||task.scheduledAt.slice(0,10)>=currentDateKey);
 const selectedWeekTasks=contextTasks.filter(task=>task.bucket==="week"&&!selectedDayTaskIds.has(task.id)&&isCurrentOrFutureTask(task)).sort((a,b)=>(a.scheduledAt||"").localeCompare(b.scheduledAt||""));
 const selectedMonthTasks=contextTasks.filter(task=>task.bucket==="month"&&!selectedDayTaskIds.has(task.id)&&isCurrentOrFutureTask(task)).sort((a,b)=>(a.scheduledAt||"").localeCompare(b.scheduledAt||""));
 const selectedPanelTasks=calendarTaskRange==="day"?selectedDayTasks:calendarTaskRange==="week"?selectedWeekTasks:selectedMonthTasks;
 const calendarDayPreviewKey=calendarDayPreview?todayKey(calendarDayPreview):"";
 const calendarDayPreviewEvents=calendarDayPreview?contextEvents.filter(event=>eventOccursOnDate(event,calendarDayPreviewKey)).sort((a,b)=>a.start.localeCompare(b.start)):[];
 const weekDates=(()=>{
  const start=new Date(cursor);
  start.setHours(0,0,0,0);
  start.setDate(start.getDate()-((start.getDay()+6)%7));
  return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
 })();
 const agendaDayEvents=(date:Date)=>contextEvents
  .filter(e=>eventOccursOnDate(e,todayKey(date)))
  .sort((a,b)=>a.start.localeCompare(b.start));

 // Calendar boards are historical views, so they must keep completed/past events.
 // Only the explicit list views and the selected-date detail use the upcoming filter.
 const dayModeEvents=agendaDayEvents(cursor);
 const monthStart=new Date(cursor.getFullYear(),cursor.getMonth(),1);
 const monthEnd=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
 const monthEvents=contextEvents
  .filter(e=>{
   const start=new Date(e.start).getTime();
   const end=new Date(e.end||e.start).getTime();
   return start<monthEnd.getTime()&&end>=monthStart.getTime();
  })
  .filter(e=>(e.title+" "+(e.location||"")).toLowerCase().includes(monthSearch.trim().toLowerCase()))
  .filter(e=>{
   if(monthStatus==="all")return true;
   const status=eventStatus(e);
   return monthStatus==="done"?status==="완료":monthStatus==="doing"?status==="진행 중":status==="예정";
  })
  .sort((a,b)=>a.start.localeCompare(b.start));
 const monthEventGroups=monthEvents.reduce<Record<string,EventItem[]>>((acc,e)=>{
  const key=eventDateKey(e.start);
  (acc[key]??=[]).push(e);
  return acc;
 },{});
 const weekListGroups=weekDates.reduce<Record<string,EventItem[]>>((acc,date)=>{
  const items=agendaDayEvents(date);
  if(items.length)acc[todayKey(date)]=items;
  return acc;
 },{});
 const filteredPeople=local.people
  .filter(p=>(p.name+" "+p.phone+" "+p.email+" "+p.organization+" "+p.tags.join(" ")+" "+p.note).toLowerCase().includes(peopleSearch.trim().toLowerCase()))
  .filter(p=>{
   if(peopleFilter==="all")return true;
   if(peopleFilter==="due")return !!p.nextContact&&p.nextContact<=todayKey();
   if(peopleFilter==="waiting")return !!p.waiting;
   if(peopleFilter==="stale"){
    if(!p.lastContact)return true;
    const d=new Date(`${p.lastContact}T00:00:00`);
    return Date.now()-d.getTime()>=30*86400000;
   }
   return true;
  });


 const greeting="좋은 하루입니다, 황제.";
 const activityTitleLabel:Record<ActivityType,string>={
  running:"훈련 이름",workout:"운동 이름",martial:"훈련 이름",reading:"책 이름",
  study:"공부 내용",church:"교육·교회 활동",photo:"촬영 내용",other:"활동 이름"
 };
 const activityPlaceholder:Record<ActivityType,string>={
  running:"예: 10km 조깅",workout:"예: 상체 근력 운동",martial:"예: 기본기 훈련",
  reading:"예: 설득의 심리학",study:"예: 철학 1강 정리",church:"예: 중등부 교안 작성",
  photo:"예: 야간 인물 촬영",other:"원하는 활동 이름을 직접 입력"
 };
 const selectedProjectData=local.projects.find(p=>p.id===selectedProject)??local.projects[0];
 const projectIntelligence=useMemo(()=>local.projects.map(project=>getProjectIntelligence({project,tasks:local.tasks,goals:local.goals,activities:local.activities,notes:local.notes,recurringTasks:local.recurringTasks,recurringTaskCompletions:local.recurringTaskCompletions,now})),[local.projects,local.tasks,local.goals,local.activities,local.notes,local.recurringTasks,local.recurringTaskCompletions,now]);
 const selectedProjectIntelligence=selectedProjectData?projectIntelligence.find(item=>item.project.id===selectedProjectData.id):undefined;
 const projectProgressValue=(project:Project)=>projectIntelligence.find(item=>item.project.id===project.id)?.calculatedProgress??(project.status==="done"?100:0);
 const projectProgressNeedsPeriod=(project:Project)=>{const info=projectIntelligence.find(item=>item.project.id===project.id);return Boolean(info?.connectedRoutines.length&&(!project.startDate||!project.dueDate)&&!info.connectedTodos.length&&!project.milestones.length)};
 const reviewDates=Object.keys(local.reviews).sort((a,b)=>b.localeCompare(a));
 const projectNameById=(projectId?:string)=>projectId?local.projects.find(project=>project.id===projectId)?.name:undefined;
 const hasEveningReview=(review:Review)=>Boolean(review.status||review.good.trim()||review.learned.trim()||review.joy.trim()||gratitudeArray(review.eveningGratitude).some(Boolean));
 const eveningReviews=Object.values(local.reviews as Record<string,Review>).filter(hasEveningReview);
 const timeline:TimelineItem[]=[...local.activities.map(a=>({date:a.date,kind:activityLabels[a.type],title:a.title,note:[a.note,a.learned?`배운 것: ${a.learned}`:"",a.applied?`적용: ${a.applied}`:""].filter(Boolean).join(" · "),project:projectNameById(a.projectId)})),...local.notes.map(n=>({date:n.date,kind:noteLabels[n.type],title:n.title,note:n.body,project:projectNameById(n.projectId)})),...eveningReviews.map(r=>({date:r.date,kind:"리뷰",title:r.goal||"하루 리뷰",note:[r.good?`잘한 점: ${r.good}`:"",r.learned?`배운 점: ${r.learned}`:"",r.joy?`즐거움: ${r.joy}`:""].filter(Boolean).join(" · ")})),...local.tasks.filter(t=>t.done).map(t=>({date:t.doneAt||t.scheduledAt?.slice(0,10)||todayKey(),kind:"완료",title:t.title,note:t.note??"",project:projectNameById(t.projectId)}))].sort((a,b)=>b.date.localeCompare(a.date));
 const activityKinds=new Set(Object.values(activityLabels));
 const noteKinds=new Set(Object.values(noteLabels));
 const filteredTimeline=timeline.filter(item=>recordFilter==="all"||recordFilter==="review"&&item.kind==="리뷰"||recordFilter==="activity"&&activityKinds.has(item.kind)||recordFilter==="note"&&noteKinds.has(item.kind));
 const recordFilterLabel=recordFilter==="all"?"전체":recordFilter==="review"?"리뷰":recordFilter==="activity"?"활동":"노트";
 const filteredTimelineGroups=groupTimeline(filteredTimeline);
 const timelineGroups=groupTimeline(timeline);

 const searchResults=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return[];return [
  ...local.tasks.filter(x=>x.title.toLowerCase().includes(q)).map(x=>({kind:"할 일",title:x.title,note:bucketLabels[x.bucket]})),
  ...local.projects.filter(x=>(x.name+x.goal+x.next+x.note).toLowerCase().includes(q)).map(x=>({kind:"프로젝트",title:x.name,note:x.next})),
  ...local.people.filter(x=>(x.name+x.note+x.tags.join(" ")).toLowerCase().includes(q)).map(x=>({kind:"사람",title:x.name,note:x.tags.join(" · ")})),
  ...local.activities.filter(x=>(x.title+x.note+x.learned+x.applied).toLowerCase().includes(q)).map(x=>({kind:activityLabels[x.type],title:x.title,note:x.note})),
  ...local.notes.filter(x=>(x.title+x.body+x.tags.join(" ")).toLowerCase().includes(q)).map(x=>({kind:noteLabels[x.type],title:x.title,note:x.body}))
 ]},[search,local]);



 const weatherLabel=(code:number)=>{
  if(code===0)return "맑음";
  if([1,2].includes(code))return "대체로 맑음";
  if(code===3)return "흐림";
  if([45,48].includes(code))return "안개";
  if([51,53,55,56,57].includes(code))return "이슬비";
  if([61,63,65,66,67,80,81,82].includes(code))return "비";
  if([71,73,75,77,85,86].includes(code))return "눈";
  if([95,96,99].includes(code))return "뇌우";
  return "날씨";
 };
 const weatherIcon=(code:number)=>{
  if(code===0)return "☀";
  if([1,2].includes(code))return "🌤";
  if(code===3)return "☁";
  if([45,48].includes(code))return "🌫";
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return "🌧";
  if([71,73,75,77,85,86].includes(code))return "🌨";
  if([95,96,99].includes(code))return "⛈";
  return "◌";
 };
 async function loadWeather(lat:number,lon:number,location="현재 위치"){
  setWeatherLoading(true);
  try{
   const q=new URLSearchParams({lat:String(lat),lon:String(lon),location});
   const r=await fetch(`/api/weather?${q}`,{cache:"no-store"});
   if(!r.ok)throw new Error("weather");
   setWeather(await r.json());
  }catch{setWeather(null)}
  finally{setWeatherLoading(false)}
 }
 function requestWeather(){
  const saved=localStorage.getItem("jeong_weather_coords");
  if(saved){
   try{
    const parsed=JSON.parse(saved);
    if(Number.isFinite(parsed?.lat)&&Number.isFinite(parsed?.lon)){void loadWeather(parsed.lat,parsed.lon,parsed.location||"현재 위치");return}
   }catch{}
  }
  if(!navigator.geolocation){setWeather(null);setWeatherLoading(false);return}
  setWeatherLoading(true);
  navigator.geolocation.getCurrentPosition(
   position=>{
    const coords={lat:position.coords.latitude,lon:position.coords.longitude,location:"현재 위치"};
    localStorage.setItem("jeong_weather_coords",JSON.stringify(coords));
    void loadWeather(coords.lat,coords.lon,coords.location);
   },
   ()=>{setWeather(null);setWeatherLoading(false)},
   {enableHighAccuracy:false,timeout:6500,maximumAge:30*60*1000}
  );
 }
 function navigateTo(next:View,options?:{preserveOrigin?:boolean;replaceHistory?:boolean}){
  const current=viewRef.current;
  if(next===current)return;
  if(!options?.preserveOrigin)setPreviousView(current);
  if(next==="review")setReviewDate(todayKey());
  if(typeof window!=="undefined"&&historyReadyRef.current){
   const state={jeong:true,jeongView:next};
   if(options?.replaceHistory)window.history.replaceState(state,"",window.location.href);
   else window.history.pushState(state,"",window.location.href);
  }
  viewRef.current=next;
  setPageLoading(true);
  setView(next);
  window.setTimeout(()=>setPageLoading(false),180);
 }
 function goBackFromDetail(){
  const target:View=["activities","notes","review","timeline"].includes(previousView)?"records":previousView;
  navigateTo(target,{preserveOrigin:true});
 }
 useEffect(()=>{viewRef.current=view},[view]);
 useEffect(()=>{
  if(typeof window==="undefined"||historyReadyRef.current)return;
  historyReadyRef.current=true;

  // Preserve the real page that opened JEONG as an explicit boundary, then place
  // JEONG Home above it. Internal navigation is pushed above Home from here on.
  // Android/PWA Back therefore walks JEONG views first and can leave only from Home.
  const initialState=window.history.state;
  if(initialState?.jeong&&initialState?.jeongView&&VALID_VIEWS.has(initialState.jeongView as View)){
   const initialView=initialState.jeongView as View;
   viewRef.current=initialView;
   setView(initialView);
  }else{
   window.history.replaceState({jeongBoundary:true},"",window.location.href);
   window.history.pushState({jeong:true,jeongView:"home"},"",window.location.href);
   viewRef.current="home";
   setView("home");
  }

  const onPopState=(event:PopStateEvent)=>{
   const next=event.state?.jeongView as View|undefined;
   if(event.state?.jeong&&next&&VALID_VIEWS.has(next)){
    viewRef.current=next;
    setPageLoading(true);
    setView(next);
    window.setTimeout(()=>setPageLoading(false),120);
    return;
   }

   // We reached JEONG's boundary. If an internal view is still visible, consume
   // that Back and restore Home. When Home is already visible, the next Back may
   // leave JEONG normally.
   if(viewRef.current!=="home"){
    window.history.pushState({jeong:true,jeongView:"home"},"",window.location.href);
    viewRef.current="home";
    setPageLoading(true);
    setView("home");
    window.setTimeout(()=>setPageLoading(false),120);
   }
  };
  window.addEventListener("popstate",onPopState);
  return()=>window.removeEventListener("popstate",onPopState);
 },[]);
 function notify(message:string,kind:"success"|"info"|"error"="success"){
  setToast({message,kind});
  window.setTimeout(()=>setToast(null),3000);
 }
 function openSearchResult(kind:string){
  if(kind==="할 일")navigateTo("home");
  else if(kind==="프로젝트")navigateTo("projects");
  else if(kind==="사람")navigateTo("people");
  else if(Object.values(activityLabels).includes(kind))navigateTo("activities");
  else navigateTo("notes");
  setSearchOpen(false);
 }
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearchOpen(true)}
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="n"){e.preventDefault();openNewEvent(selectedDate)}
   if(e.key==="Escape")setSearchOpen(false);
  };
  window.addEventListener("keydown",onKey);
  return()=>window.removeEventListener("keydown",onKey);
 },[selectedDate]);
 function persistMorning(state:LocalState){
  const nowStamp=new Date().toISOString(); const day=todayKey();
  const existing=state.dailyGoalId?state.goals.find(g=>g.id===state.dailyGoalId):undefined;
  if(!state.goal.trim())return {...state,morningDate:day,dailyGoalId:undefined,parentWeeklyGoalId:undefined,goals:existing?state.goals.filter(goal=>goal.id!==existing.id):state.goals};
  const daily:Goal={id:existing?.id??uid(),horizon:"DAY",contextId:state.contextId,parentGoalId:state.parentWeeklyGoalId,periodStart:day,periodEnd:day,title:state.goal.trim(),status:existing?.status??"active",priority:existing?.priority??"normal",createdAt:existing?.createdAt??nowStamp,updatedAt:nowStamp};
  return {...state,morningDate:day,dailyGoalId:daily.id,goals:[...state.goals.filter(g=>g.id!==daily.id),daily]};
 }
 function saveMorning(e:FormEvent){e.preventDefault();localStorage.setItem(DAILY_CONTENT_DATE_KEY,todayKey());setLocal(persistMorning);setShowMorning(false);notify("오늘 아침 기록을 저장했습니다.")}
 function defaultEventForm(date=selectedDate):EventForm{
  const st=new Date(date);st.setHours(9,0,0,0);const en=new Date(st);en.setHours(10,0,0,0);
  const contextId=contextFilter==="ALL"?"personal":local.contexts.find(context=>context.key===contextFilter)?.id??"personal";
  const calendarId=getDefaultCalendarId(local.contextCalendarPreferences,local.calendarContextMappings,contextId,visibleCalendarIds[0]||"primary");
  return {title:"",start:toLocalInput(st.toISOString()),end:toLocalInput(en.toISOString()),allDay:false,location:"",description:"",
   recurrence:"none",recurrenceUntil:"",recurrenceCount:0,recurrenceInterval:1,weeklyDays:[],
   monthlyMode:"date",holidayPolicy:"skip",excludeHolidays:false,excludeWeekends:false,reminders:[30],useDefaultReminders:false,attendees:"",addMeet:false,
   visibility:"default",transparency:"opaque",colorId:"",editScope:"single",calendarId,contextId};
 }
 function openNewEvent(date=selectedDate,returnDate:Date|null=null){setEventReturnDate(returnDate);setEventForm(defaultEventForm(date))}
 function closeEventEditor(){const returnDate=eventReturnDate;setEventForm(null);setEventReturnDate(null);if(returnDate){setSelectedDate(returnDate);setCalendarDayPreview(returnDate)}}
 function parseRecurrence(lines:string[]|undefined){
  const result={recurrence:"none" as Recurrence,recurrenceUntil:"",recurrenceCount:0,recurrenceInterval:1,weeklyDays:[] as string[],monthlyMode:"date" as EventForm["monthlyMode"]};
  const rule=lines?.find(x=>x.startsWith("RRULE:"));if(!rule)return result;
  const pairs=Object.fromEntries(rule.replace("RRULE:","").split(";").map(x=>x.split("=")));
  result.recurrenceInterval=Number(pairs.INTERVAL||1);
  result.recurrenceCount=Number(pairs.COUNT||0);
  if(pairs.UNTIL)result.recurrenceUntil=`${pairs.UNTIL.slice(0,4)}-${pairs.UNTIL.slice(4,6)}-${pairs.UNTIL.slice(6,8)}`;
  result.weeklyDays=(pairs.BYDAY||"").split(",").filter(Boolean).map((x:string)=>x.replace(/^-?\d/,""));
  if(pairs.FREQ==="DAILY")result.recurrence="daily";
  else if(pairs.FREQ==="WEEKLY"){
   if(pairs.BYDAY==="MO,TU,WE,TH,FR")result.recurrence="weekdays";
   else result.recurrence=result.recurrenceInterval===2?"biweekly":"weekly";
  }else if(pairs.FREQ==="MONTHLY"){
   result.recurrence="monthly";
   if(pairs.BYMONTHDAY==="-1")result.monthlyMode="lastDay";
   else if((pairs.BYDAY||"").startsWith("-1"))result.monthlyMode="lastWeekday";
   else if(pairs.BYDAY)result.monthlyMode="nthWeekday";
  }else if(pairs.FREQ==="YEARLY")result.recurrence="yearly";
  return result;
 }
 async function fetchSeriesMaster(id:string,calendarId:string){
  const q=new URLSearchParams({id,calendarId});
  const r=await fetch(`/api/calendar?${q}`,{cache:"no-store"});
  if(!r.ok)return null;
  return (await r.json()).event as EventItem;
 }
 async function openEvent(e:EventItem,returnDate:Date|null=null){
  setEventReturnDate(returnDate);
  // Open the editor immediately. Recurrence metadata for an instance can arrive a moment later.
  // This avoids making every schedule click wait for a network round-trip.
  const immediateParsed=parseRecurrence(e.recurrence);
  setEventForm({id:e.id,seriesId:e.recurringEventId,title:e.title,
   start:e.allDay?dateInput(e.start):toLocalInput(e.start),
   end:e.allDay?dateInput(e.end):toLocalInput(e.end),allDay:!!e.allDay,location:e.location,description:e.description,
   ...immediateParsed,excludeHolidays:false,excludeWeekends:false,holidayPolicy:"skip",
   reminders:e.reminders?.length?e.reminders:(e.useDefaultReminders?[30]:[]),useDefaultReminders:!!e.useDefaultReminders,attendees:(e.attendees??[]).join(", "),addMeet:!!e.hangoutLink,
   visibility:(e.visibility as EventForm["visibility"])??"default",transparency:(e.transparency as EventForm["transparency"])??"opaque",
   colorId:e.colorId??"",editScope:e.recurringEventId?"single":"series",calendarId:e.calendarId||"primary",contextId:eventContextId(e)});
  if(e.recurringEventId){
   const master=await fetchSeriesMaster(e.recurringEventId,e.calendarId||"primary");
   if(master){
    const parsed=parseRecurrence(master.recurrence);
    setEventForm(current=>current?.id===e.id?{...current,...parsed}:current);
   }
  }
 } async function saveEvent(e:FormEvent){
  e.preventDefault();if(!eventForm||savingEvent)return;
  setSavingEvent(true);
  const sourceEvent=eventForm.id?events.find(item=>item.id===eventForm.id&&(!eventForm.calendarId||item.calendarId===eventForm.calendarId))
   ??operationalEvents.find(item=>item.id===eventForm.id&&(!eventForm.calendarId||item.calendarId===eventForm.calendarId))
   :undefined;
  const targetId=eventForm.editScope==="series"&&eventForm.seriesId?eventForm.seriesId:eventForm.id;
  const rule=recurrenceRule(eventForm);
  let excludedDates:string[]=[];let movedDates:{from:string;to:string}[]=[];
  if(rule&&(eventForm.excludeHolidays||eventForm.excludeWeekends)){
   try{
    const startDate=eventForm.start.slice(0,10);
    const fallbackEnd=addDaysYmd(startDate,365);
    const q=new URLSearchParams({
     start:startDate,end:eventForm.recurrenceUntil||fallbackEnd,
     holidays:String(eventForm.excludeHolidays),weekends:String(eventForm.excludeWeekends),
     policy:eventForm.holidayPolicy
    });
    const ex=await fetch(`/api/calendar/exclusions?${q}`);
    if(ex.ok){const data=await ex.json();excludedDates=data.dates??[];movedDates=data.moved??[]}
   }catch{}
  }
  const timedSuffix=localTimeParts(eventForm.start);
  const exLines=excludedDates.map(date=>eventForm.allDay
   ?`EXDATE;VALUE=DATE:${compactYmd(date)}`
   :`EXDATE;TZID=Asia/Seoul:${compactYmd(date)}T${timedSuffix}`);
  const rLines=movedDates.map(item=>eventForm.allDay
   ?`RDATE;VALUE=DATE:${compactYmd(item.to)}`
   :`RDATE;TZID=Asia/Seoul:${compactYmd(item.to)}T${timedSuffix}`);
  const recurrenceLines=rule?[rule,...exLines,...rLines]:[];
  const body={...eventForm,colorId:contextEventColorId(eventForm.contextId),id:targetId,instanceId:eventForm.id,
   splitFrom:eventForm.start,calendarId:eventForm.calendarId,
   start:eventForm.allDay?eventForm.start:new Date(eventForm.start).toISOString(),
   end:eventForm.allDay?eventForm.end:new Date(eventForm.end).toISOString(),
   // A single recurring occurrence must not receive the master RRULE again.
   // Re-sending it can detach/create an exception that looks like a duplicate.
   recurrence:eventForm.seriesId&&eventForm.editScope==="single"?undefined:recurrenceLines,
   attendees:eventForm.attendees.split(",").map(x=>x.trim()).filter(Boolean)};
  const isEditing=Boolean(eventForm.id);
  if(isEditing&&!targetId){setSavingEvent(false);notify("수정할 일정 식별자를 찾지 못했습니다.","error");return}
  const method=isEditing?"PATCH":"POST";
  const r=await fetch("/api/calendar",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok){const detail=await r.text();console.error(detail);setSavingEvent(false);notify("Google Calendar 저장에 실패했습니다.","error");return}
  const savedPayload=await r.json().catch(()=>null) as {event?:EventItem}|null;
  const savedEvent=savedPayload?.event;
  if(isEditing&&sourceEvent&&savedEvent&&eventForm.editScope!=="series"){
   setEvents(current=>replaceEditedEvent(current,sourceEvent,savedEvent));
   setOperationalEvents(current=>replaceEditedEvent(current,sourceEvent,savedEvent));
  }
  const contextTarget:EventItem={...(savedEvent??{} as EventItem),id:savedEvent?.id??targetId??eventForm.id??"",recurringEventId:savedEvent?.recurringEventId??eventForm.seriesId,calendarId:savedEvent?.calendarId??eventForm.calendarId,title:savedEvent?.title??eventForm.title,start:savedEvent?.start??eventForm.start,end:savedEvent?.end??eventForm.end,location:savedEvent?.location??eventForm.location,description:savedEvent?.description??eventForm.description};
  const overrideKey=calendarEventContextKey(contextTarget);
  if(overrideKey&&eventForm.contextId){
   setLocal(state=>({...state,calendarEventContextOverrides:[...(state.calendarEventContextOverrides??[]).filter(item=>item.eventKey!==overrideKey),{eventKey:overrideKey,contextId:eventForm.contextId,updatedAt:new Date().toISOString()}]}));
  }
  closeEventEditor();await refreshCalendarData();setSavingEvent(false);notify(eventForm.id?"일정을 수정했습니다.":"일정을 저장했습니다.");
 }
 async function deleteEvent(scope:"single"|"future"|"series"="single"){
  if(!eventForm?.id)return;
  const message=scope==="series"
   ?"이 반복 일정 전체를 삭제할까요? 이전·이후 일정이 모두 삭제됩니다."
   :scope==="future"
   ?"이 일정과 이후 반복 일정을 모두 삭제할까요?"
   :"선택한 일정만 삭제할까요?";
  if(!confirm(message))return;
  const q=new URLSearchParams({
   id:eventForm.id,calendarId:eventForm.calendarId,scope,
   seriesId:eventForm.seriesId||"",splitFrom:eventForm.start
  });
  const r=await fetch(`/api/calendar?${q}`,{method:"DELETE"});
  if(!r.ok){alert("Google Calendar 일정 삭제에 실패했습니다.");return}
  const tombstone:DeletedEventTombstone={id:eventForm.id,calendarId:eventForm.calendarId,seriesId:eventForm.seriesId||undefined,scope,from:eventForm.start,expiresAt:Date.now()+45_000};
  deletedEventTombstones.current=[...deletedEventTombstones.current.filter(item=>item.expiresAt>Date.now()),tombstone];
  setEvents(current=>current.filter(event=>!tombstoneMatches(event,tombstone)));
  setOperationalEvents(current=>current.filter(event=>!tombstoneMatches(event,tombstone)));
  const deletedContextKeys=new Set(
   [...events,...operationalEvents]
    .filter(event=>tombstoneMatches(event,tombstone))
    .map(event=>calendarEventContextKey(event))
    .filter((key):key is string=>Boolean(key))
  );
  if(deletedContextKeys.size)setLocal(state=>({...state,calendarEventContextOverrides:(state.calendarEventContextOverrides??[]).filter(item=>!deletedContextKeys.has(item.eventKey))}));
  closeEventEditor();await refreshCalendarData();notify("일정을 삭제했습니다.","info");
 }
 function recurrenceForQuickTask(previous?:RecurringTaskDefinition):RecurringTaskDefinition["recurrence"]{
  if(previous&&quickModeForTask(previous)===taskRepeatMode&&taskRepeatMode!=="WEEKLY"&&taskRepeatMode!=="BIWEEKLY")return previous.recurrence;
  if(taskRepeatMode==="DAILY")return {type:"DAILY"};
  if(taskRepeatMode==="WEEKDAYS")return {type:"WEEKDAYS"};
  if(taskRepeatMode==="WEEKENDS")return {type:"WEEKLY",weekdays:[0,6],interval:1};
  if(taskRepeatMode==="MONTHLY")return {type:"MONTHLY",dayOfMonth:parseYmd(currentDateKey).getDate()};
  if(taskRepeatMode==="WEEKLY_BLOCKS")return {type:"WEEKLY_BLOCKS",blocks:taskRepeatBlocks.map(block=>({...block,target:Math.max(1,block.target)}))};
  const weekdays=taskRepeatWeekdays.length?[...taskRepeatWeekdays].sort((a,b)=>a-b):[parseYmd(currentDateKey).getDay()];
  return {type:"WEEKLY",weekdays,interval:taskRepeatMode==="BIWEEKLY"?2:1};
 }
 function quickModeForTask(task:RecurringTaskDefinition):typeof taskRepeatMode{
  if(task.recurrence.type==="DAILY")return "DAILY";
  if(task.recurrence.type==="WEEKDAYS")return "WEEKDAYS";
  if(task.recurrence.type==="MONTHLY")return "MONTHLY";
  if(task.recurrence.type==="WEEKLY_BLOCKS")return "WEEKLY_BLOCKS";
  const weekdays=[...task.recurrence.weekdays].sort((a,b)=>a-b);
  if((task.recurrence.interval??1)===1&&weekdays.length===2&&weekdays[0]===0&&weekdays[1]===6)return "WEEKENDS";
  return task.recurrence.interval===2?"BIWEEKLY":"WEEKLY";
 }
 function routineSectionForTask(task:RecurringTaskDefinition):"daily"|"weekly"{
  const mode=quickModeForTask(task);
  // "주간 루틴"은 사용자가 주기를 정확히 '매주'로 만든 항목만 모읍니다.
  // 평일/주말/격주/기존 월간 데이터는 일반 '루틴'에서 관리합니다.
  return mode==="WEEKLY"||mode==="WEEKLY_BLOCKS"?"weekly":"daily";
 }
 function setRoutineMode(mode:typeof taskRepeatMode){
  setTaskRepeatMode(mode);
  setRoutineSection(mode==="WEEKLY"||mode==="WEEKLY_BLOCKS"?"weekly":"daily");
  if(mode==="WEEKENDS")setTaskRepeatWeekdays([0,6]);
  else if(mode==="WEEKDAYS")setTaskRepeatWeekdays([1,2,3,4,5]);
  else if((mode==="WEEKLY"||mode==="BIWEEKLY")&&!taskRepeatWeekdays.length)setTaskRepeatWeekdays([parseYmd(currentDateKey).getDay()]);
 }
 function toggleRoutineWeekday(day:number){
  setTaskRepeatWeekdays(current=>current.includes(day)?current.filter(item=>item!==day):[...current,day].sort((a,b)=>a-b));
 }
 function resetTaskComposer(){
  setTaskTitle("");setTaskMemo("");setTaskProject("");setTaskRepeatWeekdays([parseYmd(currentDateKey).getDay()]);setEditingRecurringId(null);
 }
 function editRecurringInline(task:RecurringTaskDefinition){
  const mode=quickModeForTask(task);
  const weekdays=task.recurrence.type==="WEEKLY"?[...task.recurrence.weekdays]:(mode==="WEEKDAYS"?[1,2,3,4,5]:mode==="WEEKENDS"?[0,6]:[parseYmd(currentDateKey).getDay()]);
  if(task.recurrence.type==="WEEKLY_BLOCKS")setTaskRepeatBlocks(task.recurrence.blocks.map(block=>({...block})));
  setRoutineSection(routineSectionForTask(task));setEditingRecurringId(task.id);setTaskTitle(task.title);setTaskMemo(task.description||"");setTaskProject(task.projectId||"");setTaskContext(task.contextId||"personal");setTaskRepeatMode(mode);setTaskRepeatWeekdays(weekdays);
  requestAnimationFrame(()=>document.querySelector<HTMLInputElement>(".taskTitleField")?.focus());
 }
 function reorderRecurringTask(dragId:string,targetId:string){
  if(dragId===targetId)return;
  const next=[...local.recurringTasks];const from=next.findIndex(item=>item.id===dragId);const to=next.findIndex(item=>item.id===targetId);if(from<0||to<0)return;
  const [moved]=next.splice(from,1);next.splice(to,0,moved);update("recurringTasks",next.map((item,index)=>({...item,sortOrder:index})));
 }
 function reorderMilestone(dragId:string,targetId:string){
  if(!selectedProjectData||dragId===targetId)return;
  const milestones=[...selectedProjectData.milestones];const from=milestones.findIndex(item=>item.id===dragId);const to=milestones.findIndex(item=>item.id===targetId);if(from<0||to<0)return;
  const [moved]=milestones.splice(from,1);milestones.splice(to,0,moved);
  update("projects",local.projects.map(project=>project.id===selectedProjectData.id?{...project,milestones}:project));
 }
 async function saveRoutineDefinition(){
  if(!taskTitle.trim())return;
  const previous=editingRecurringId?local.recurringTasks.find(task=>task.id===editingRecurringId):undefined;
  const timestamp=new Date().toISOString();
  let next:RecurringTaskDefinition={id:previous?.id||uid(),title:taskTitle.trim(),description:taskMemo.trim(),contextId:taskContext||undefined,projectId:taskProject||undefined,recurrence:recurrenceForQuickTask(previous),startDate:previous?.startDate||currentDateKey,endDate:undefined,timeOfDay:previous?.timeOfDay,durationMinutes:previous?.durationMinutes,priority:previous?.priority??"normal",showOnCalendar:previous?.showOnCalendar??false,calendarId:previous?.calendarId,calendarEventId:previous?.calendarEventId,isActive:previous?.isActive??true,createdAt:previous?.createdAt||timestamp,updatedAt:timestamp,sortOrder:previous?.sortOrder??local.recurringTasks.length};
  if(previous?.showOnCalendar){try{next=await syncRecurringCalendar(next,previous)}catch{notify("연결된 Google Calendar 반복 일정 수정에 실패했습니다.","error");return}}
  update("recurringTasks",previous?local.recurringTasks.map(task=>task.id===previous.id?next:task):[...local.recurringTasks,next]);
  notify(previous?"루틴을 수정했습니다.":"루틴을 추가했습니다.");resetTaskComposer();
 }
 async function syncRecurringCalendar(next:RecurringTaskDefinition,previous?:RecurringTaskDefinition){
  const shouldSync=next.isActive&&next.showOnCalendar&&!!next.timeOfDay;
  const calendarId=getDefaultCalendarId(local.contextCalendarPreferences,local.calendarContextMappings,next.contextId||"personal",next.calendarId||visibleCalendarIds[0]||"primary");
  const movingCalendar=Boolean(previous?.calendarEventId&&previous.calendarId&&previous.calendarId!==calendarId);
  if(previous?.calendarEventId&&!shouldSync){
   const deleteResponse=await fetch(`/api/calendar?id=${encodeURIComponent(previous.calendarEventId)}&calendarId=${encodeURIComponent(previous.calendarId||"primary")}`,{method:"DELETE"});
   if(!deleteResponse.ok)throw new Error("calendar_delete_failed");
   return {...next,calendarId:next.showOnCalendar?calendarId:undefined,calendarEventId:undefined};
  }
  if(!shouldSync)return {...next,calendarId:next.showOnCalendar?calendarId:undefined,calendarEventId:undefined};
  if(!next.durationMinutes||next.durationMinutes<=0)throw new Error("calendar_duration_required");
  const start=new Date(`${next.startDate}T${next.timeOfDay}:00`);
  const end=new Date(start.getTime()+next.durationMinutes*60000);
  const body={id:movingCalendar?undefined:next.calendarEventId,title:next.title,start:start.toISOString(),end:end.toISOString(),location:"",description:next.description||"JEONG 루틴",recurrence:[recurrenceToGoogleRrule(next)],reminders:[30],calendarId};
  const response=await fetch("/api/calendar",{method:body.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!response.ok)throw new Error("calendar_sync_failed");
  const saved=(await response.json()).event as EventItem|undefined;
  if(movingCalendar&&previous?.calendarEventId){
   const deleted=await fetch(`/api/calendar?id=${encodeURIComponent(previous.calendarEventId)}&calendarId=${encodeURIComponent(previous.calendarId||"primary")}`,{method:"DELETE"});
   if(!deleted.ok){
    if(saved?.id)await fetch(`/api/calendar?id=${encodeURIComponent(saved.id)}&calendarId=${encodeURIComponent(calendarId)}`,{method:"DELETE"});
    throw new Error("calendar_move_cleanup_failed");
   }
  }
  return {...next,calendarId,calendarEventId:saved?.id||next.calendarEventId};
 }
 function setRecurringCompletion(taskId:string,date:string,status:RecurringTaskCompletion["status"]){
  const existing=local.recurringTaskCompletions.find(item=>item.recurringTaskId===taskId&&item.occurrenceDate===date);
  const remaining=local.recurringTaskCompletions.filter(item=>!(item.recurringTaskId===taskId&&item.occurrenceDate===date));
  update("recurringTaskCompletions",existing?.status===status?remaining:[...remaining,{recurringTaskId:taskId,occurrenceDate:date,status,completedAt:status==="done"?new Date().toISOString():undefined}]);
 }
 async function setRecurringActive(task:RecurringTaskDefinition,isActive:boolean){
  let next={...task,isActive,updatedAt:new Date().toISOString()};
  try{next=await syncRecurringCalendar(next,task)}catch{notify("Google Calendar 연결 변경에 실패했습니다.","error");return}
  update("recurringTasks",local.recurringTasks.map(item=>item.id===task.id?next:item));
  notify(isActive?"루틴을 다시 시작했습니다.":"루틴을 일시 중지했습니다.","info");refreshCalendarData();
 }
 async function removeRecurringTask(task:RecurringTaskDefinition){
  const calendarNote=task.calendarEventId?"\n연결된 Google Calendar 반복 일정도 함께 삭제됩니다.":"";
  if(!confirm(`'${task.title}' 루틴을 삭제할까요?${calendarNote}`))return;
  if(task.calendarEventId){
   const response=await fetch(`/api/calendar?id=${encodeURIComponent(task.calendarEventId)}&calendarId=${encodeURIComponent(task.calendarId||"primary")}`,{method:"DELETE"});
   if(!response.ok){notify("Google Calendar 반복 일정 삭제에 실패했습니다.","error");return}
  }
  setLocal(state=>({...state,recurringTasks:state.recurringTasks.filter(item=>item.id!==task.id),recurringTaskCompletions:state.recurringTaskCompletions.filter(item=>item.recurringTaskId!==task.id)}));
  if(editingRecurringId===task.id)resetTaskComposer();
  notify("루틴을 삭제했습니다.","info");
  if(task.calendarEventId)refreshCalendarData();
 }
 function addPerson(){if(!personName.trim())return;update("people",[...local.people,{id:uid(),name:personName.trim(),tags:[personTag],lastContact:"",nextContact:"",note:""}]);setPersonName("")}
 function normalizedPhone(value=""){return value.replace(/[^\d+]/g,"").replace(/^82(?=10)/,"0")}
 function mergePeople(imported:Partial<Person>[],source:string){
  let added=0,updated=0;
  const next=[...local.people];
  for(const raw of imported){
   const name=(raw.name||"").trim();
   const phone=normalizedPhone(raw.phone||"");
   const email=(raw.email||"").trim().toLowerCase();
   if(!name&&!phone&&!email)continue;
   const index=next.findIndex(p=>
    (phone&&normalizedPhone(p.phone||"")===phone)||
    (email&&(p.email||"").trim().toLowerCase()===email)||
    (!phone&&!email&&name&&p.name.trim()===name)
   );
   if(index>=0){
    const current=next[index];
    next[index]={...current,
     name:current.name||name,
     phone:current.phone||raw.phone||"",
     email:current.email||raw.email||"",
     organization:current.organization||raw.organization||"",
     source:current.source||source,
     tags:Array.from(new Set([...(current.tags||[]),...(raw.tags||[])]))
    };
    updated++;
   }else{
    next.push({
     id:uid(),name:name||raw.phone||raw.email||"이름 없음",
     tags:raw.tags?.length?raw.tags:["연락처"],
     lastContact:"",nextContact:"",note:"",
     phone:raw.phone||"",email:raw.email||"",
     organization:raw.organization||"",source,waiting:false,logs:[]
    });
    added++;
   }
  }
  update("people",next);
  notify(`${added}명 추가 · ${updated}명 병합`);
 }
 async function importGoogleContacts(){
  setContactsImporting(true);
  try{
   const r=await fetch("/api/contacts/google",{cache:"no-store"});
   if(r.status===401){notify("Google 연락처 권한이 필요합니다. 다시 로그인해 주세요.","error");return}
   if(!r.ok){notify("Google 연락처를 불러오지 못했습니다.","error");return}
   const data=await r.json();
   mergePeople(data.contacts??[],"Google 연락처");
  }finally{setContactsImporting(false)}
 }
 async function pickDeviceContacts(){
  const nav=navigator as any;
  if(!nav.contacts?.select){
   notify("이 브라우저는 휴대폰 연락처 선택을 지원하지 않습니다. VCF 파일을 사용해 주세요.","info");
   return;
  }
  try{
   const selected=await nav.contacts.select(["name","tel","email"],{multiple:true});
   mergePeople((selected??[]).map((c:any)=>({
    name:Array.isArray(c.name)?c.name[0]??"":c.name??"",
    phone:Array.isArray(c.tel)?c.tel[0]??"":c.tel??"",
    email:Array.isArray(c.email)?c.email[0]??"":c.email??"",
    tags:["휴대폰"]
   })),"휴대폰 연락처");
  }catch{}
 }
 function importVCard(file:File){
  const reader=new FileReader();
  reader.onload=()=>{
   const text=String(reader.result||"");
   const cards=text.split(/END:VCARD/i).map(x=>x.trim()).filter(Boolean);
   const contacts=cards.map(card=>{
    const line=(key:string)=>{
     const match=card.match(new RegExp(`(?:^|\\n)${key}(?:;[^:]*)?:([^\\r\\n]+)`,"i"));
     return match?.[1]?.trim()||"";
    };
    return {name:line("FN"),phone:line("TEL"),email:line("EMAIL"),organization:line("ORG"),tags:["VCF"]};
   });
   mergePeople(contacts,"VCF 파일");
  };
  reader.readAsText(file);
 }

 function addActivity(){
  const title=activityTitle.trim();
  if(!title)return notify(`${activityTitleLabel[activityType]}을 입력해 주세요.`,"error");
  const unit=activityType==="running"?"km":activityType==="reading"?"page":activityType==="workout"?"세트":"";
  update("activities",[...local.activities,{id:uid(),date:activityDate,type:activityType,title,duration:activityDuration,amount:activityAmount,unit,note:activityNote,learned:activityLearned,applied:activityApplied,meta:{},projectId:activityProject||undefined}]);
  setActivityTitle("");setActivityNote("");setActivityLearned("");setActivityApplied("");setActivityAmount(0);
  notify("활동 기록을 저장했습니다.");
 }

 function createProject(){
  const name=newProjectName.trim();
  if(!name)return notify("프로젝트 이름을 입력해 주세요.","error");
  const project:Project={id:uid(),name,goal:newProjectGoal.trim(),next:"",status:"planning",milestones:[],note:"",startDate:newProjectStartDate||todayKey(),...(newProjectDueDate?{dueDate:newProjectDueDate}:{})};
  update("projects",[...local.projects,project]);
  setSelectedProject(project.id);
  setNewProjectName("");setNewProjectGoal("");setNewProjectStartDate("");setNewProjectDueDate("");setProjectDialog(null);
  notify("새 프로젝트를 만들었습니다.");
 }
 function updateProjectPeriod(projectId:string,nextStart?:string,nextDue?:string){
  const project=local.projects.find(item=>item.id===projectId);
  if(!project)return;
  const effectiveStart=nextStart||undefined;
  const effectiveDue=nextDue||undefined;
  update("projects",local.projects.map(item=>item.id===projectId?{...item,startDate:effectiveStart,dueDate:effectiveDue}:item));
  update("recurringTasks",local.recurringTasks.map(task=>task.projectId===projectId?{...task,startDate:effectiveStart||task.startDate,endDate:effectiveDue,updatedAt:new Date().toISOString()}:task));
 }
 function addProjectRoutine(){
  if(!selectedProjectData)return;
  const clean=projectRoutineTitle.trim();
  if(!clean)return notify("루틴 이름을 입력해 주세요.","error");
  const day=parseYmd(currentDateKey).getDay();
  const recurrence:RecurringTaskDefinition["recurrence"]=projectRoutineMode==="DAILY"?{type:"DAILY"}:projectRoutineMode==="WEEKDAYS"?{type:"WEEKDAYS"}:projectRoutineMode==="WEEKENDS"?{type:"WEEKLY",weekdays:[0,6],interval:1}:{type:"WEEKLY",weekdays:[day],interval:projectRoutineMode==="BIWEEKLY"?2:1};
  const timestamp=new Date().toISOString();
  const effectiveStart=selectedProjectData.startDate||currentDateKey;
  const routine:RecurringTaskDefinition={id:uid(),title:clean,description:"",projectId:selectedProjectData.id,milestoneId:projectRoutineMilestone||undefined,recurrence,startDate:effectiveStart,endDate:selectedProjectData.dueDate,priority:"normal",showOnCalendar:false,isActive:true,createdAt:timestamp,updatedAt:timestamp,sortOrder:local.recurringTasks.length};
  if(!selectedProjectData.startDate)update("projects",local.projects.map(project=>project.id===selectedProjectData.id?{...project,startDate:effectiveStart}:project));
  update("recurringTasks",[...local.recurringTasks,routine]);
  setProjectRoutineTitle("");
  setProjectRoutineMilestone("");
  notify("프로젝트 루틴을 추가했습니다.");
 }
 function createMilestone(){
  if(!selectedProjectData)return;
  const title=newMilestoneTitle.trim();
  if(!title)return notify("중간 목표 이름을 입력해 주세요.","error");
  const milestoneId=uid();
  update("projects",local.projects.map(p=>p.id===selectedProjectData.id
   ?{...p,milestones:[...p.milestones,{id:milestoneId,title,done:false,weight:Math.max(0,Math.min(100,newMilestoneWeight||0)),...(newMilestoneStartDate?{startDate:newMilestoneStartDate}:{}),...(newMilestoneDueDate?{dueDate:newMilestoneDueDate}:{})}]}
   :p));
  if(newMilestoneRoutineIds.length)update("recurringTasks",local.recurringTasks.map(task=>newMilestoneRoutineIds.includes(task.id)?{...task,projectId:selectedProjectData.id,milestoneId,updatedAt:new Date().toISOString()}:task));
  setNewMilestoneTitle("");setNewMilestoneWeight(25);setNewMilestoneStartDate("");setNewMilestoneDueDate("");setNewMilestoneRoutineIds([]);setProjectDialog(null);
  notify("중간 목표를 추가했습니다.");
 }
 function setCalendarContext(calendarId:string,contextId?:string){
  setLocal(state=>({...state,
   calendarContextMappings:[...state.calendarContextMappings.filter(mapping=>mapping.calendarId!==calendarId),...(contextId?[{calendarId,contextId}]:[])],
   contextCalendarPreferences:contextId?state.contextCalendarPreferences:state.contextCalendarPreferences.filter(preference=>preference.defaultCalendarId!==calendarId)
  }));
 }
 function setDefaultContextCalendar(contextId:string,defaultCalendarId?:string){
  setLocal(state=>({...state,contextCalendarPreferences:[...state.contextCalendarPreferences.filter(preference=>preference.contextId!==contextId),...(defaultCalendarId?[{contextId,defaultCalendarId}]:[])]}));
 }
 function addNote(){if(!noteTitle.trim()&&!noteBody.trim())return;update("notes",[...local.notes,{id:uid(),date:todayKey(),type:noteType,title:noteTitle||noteLabels[noteType],body:noteBody,tags:[],projectId:noteProject||undefined}]);setNoteTitle("");setNoteBody("")}
 function addChapter(){if(!chapterTitle.trim())return;update("chapters",[...local.chapters.map(c=>({...c,active:false})),{id:uid(),title:chapterTitle,startDate:todayKey(),endDate:"",description:chapterDescription,active:true}]);setChapterTitle("");setChapterDescription("")}


 async function saveTaskEdit(){
  if(!editingTask)return;
  const old=local.tasks.find(t=>t.id===editingTask.id);
  let next={...editingTask};
  if(next.syncCalendar&&next.scheduledAt){
   if(!next.scheduledAt.includes("T"))return alert("Google Calendar 연결에는 날짜와 시간을 함께 입력해 주세요.");
   const st=new Date(next.scheduledAt), en=new Date(st.getTime()+next.durationMinutes*60000);
   const calendarId=getDefaultCalendarId(local.contextCalendarPreferences,local.calendarContextMappings,next.contextId??"",next.calendarId||visibleCalendarIds[0]||"primary");
   const movingCalendar=Boolean(old?.calendarEventId&&old.calendarId&&old.calendarId!==calendarId);
   const body={id:movingCalendar?undefined:next.calendarEventId,title:next.title,start:st.toISOString(),end:en.toISOString(),location:"",description:"JEONG 할 일",recurrence:[],reminders:[30],calendarId};
   const r=await fetch("/api/calendar",{method:body.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!r.ok)return alert("Google Calendar 동기화에 실패했습니다.");
   const saved=(await r.json()).event as EventItem|undefined;
   if(saved?.id)next.calendarEventId=saved.id;
   if(movingCalendar&&old?.calendarEventId){
    const deleted=await fetch(`/api/calendar?id=${encodeURIComponent(old.calendarEventId)}&calendarId=${encodeURIComponent(old.calendarId||"primary")}`,{method:"DELETE"});
    if(!deleted.ok){
     if(saved?.id)await fetch(`/api/calendar?id=${encodeURIComponent(saved.id)}&calendarId=${encodeURIComponent(calendarId)}`,{method:"DELETE"});
     return alert("기존 Google Calendar 일정을 정리하지 못해 변경을 취소했습니다.");
    }
   }
   next.calendarId=calendarId;
  }else if(old?.calendarEventId&&!next.syncCalendar){
   if(confirm("연결된 Google Calendar 일정도 삭제할까요?"))await fetch(`/api/calendar?id=${encodeURIComponent(old.calendarEventId)}&calendarId=${encodeURIComponent(old.calendarId||"primary")}`,{method:"DELETE"});
   next.calendarEventId=undefined;
  }
  update("tasks",local.tasks.map(t=>t.id===next.id?next:t));setEditingTask(null);refreshCalendarData();
 }
 async function removeTask(t:TaskItem){
  if(t.calendarEventId&&confirm("연결된 Google Calendar 일정도 함께 삭제할까요?"))await fetch(`/api/calendar?id=${encodeURIComponent(t.calendarEventId)}&calendarId=${encodeURIComponent(t.calendarId||"primary")}`,{method:"DELETE"});
  update("tasks",local.tasks.filter(x=>x.id!==t.id));refreshCalendarData();
 }
 function saveActivityEdit(){if(!editingActivity)return;update("activities",local.activities.map(a=>a.id===editingActivity.id?editingActivity:a));setEditingActivity(null)}
 function saveNoteEdit(){if(!editingNote)return;update("notes",local.notes.map(n=>n.id===editingNote.id?editingNote:n));setEditingNote(null)}
 function savePersonEdit(){if(!editingPerson)return;update("people",local.people.map(p=>p.id===editingPerson.id?editingPerson:p));setEditingPerson(null)}
 function addContactLog(){
  if(!editingPerson||!contactSummary.trim())return;
  const log={id:uid(),date:todayKey(),channel:contactChannel,summary:contactSummary.trim()};
  const next={...editingPerson,lastContact:todayKey(),logs:[...(editingPerson.logs??[]),log]};
  setEditingPerson(next);update("people",local.people.map(p=>p.id===next.id?next:p));setContactSummary("");
 }
 function importBackup(file:File){
  const reader=new FileReader();
  reader.onload=()=>{try{const data=JSON.parse(String(reader.result));const normalized=normalizeLocalState(data,{defaultState,noteLabels});setLocal(normalized);alert("백업을 복원했습니다.")}catch{alert("올바른 JEONG 백업 파일이 아닙니다.")}};
  reader.readAsText(file);
 }
 const dayEvents=contextEvents.filter(e=>new Date(e.start).toDateString()===new Date(`${dayDate}T00:00:00`).toDateString());
 const dayActivities=local.activities.filter(a=>a.date===dayDate);
 const dayReview=local.reviews[dayDate];


 function buildAiPrompt(type:AiPromptType){
  const today=todayKey();
  const todayRoutineOccurrences=getOccurrencesForDate(local.recurringTasks,currentDateKey,local.recurringTaskCompletions);
  const todayRoutines=todayRoutineOccurrences.map(occurrence=>{
   const project=occurrence.task.projectId?local.projects.find(item=>item.id===occurrence.task.projectId):undefined;
   const milestone=project&&occurrence.task.milestoneId?project.milestones.find(item=>item.id===occurrence.task.milestoneId):undefined;
   return {title:occurrence.task.title,status:occurrence.status==="done"?"done" as const:occurrence.status==="skipped"?"skipped" as const:"pending" as const,project:project?.name,milestone:milestone?.title};
  });
  const events=operatingContext.calendar.events.map(event=>{
   const eventStart=new Date(event.start).getTime();
   const eventEnd=new Date(event.end||event.start).getTime();
   const nowMs=now.getTime();
   const state=eventEnd<nowMs?"done" as const:eventStart<=nowMs&&eventEnd>=nowMs?"current" as const:event===operatingContext.calendar.nextEvent?"next" as const:"upcoming" as const;
   return {title:event.title,start:event.start,end:event.end,context:event.context,state};
  });
  const taskState=(task:TaskItem)=>({title:task.title,dueDate:task.dueDate||task.scheduledAt?.slice(0,10),project:projectNameById(task.projectId),context:local.contexts.find(context=>context.id===task.contextId)?.name,carried:Boolean(task.carriedFrom||task.carryHistory?.length)});
  const projects=operatingContext.projects.map(info=>({
   name:info.project.name,
   goal:info.project.goal,
   status:info.project.status,
   progress:info.calculatedProgress,
   start:info.project.startDate,
   due:info.project.dueDate,
   nextAction:info.nextAction?.title||info.project.next,
   stalled:info.stalled,
   risks:info.risks,
   milestones:info.project.milestones.map(milestone=>({
    title:milestone.title,
    done:milestone.done,
    start:milestone.startDate??info.project.startDate,
    due:milestone.dueDate??info.project.dueDate,
    routines:info.connectedRoutines.filter(routine=>routine.milestoneId===milestone.id).map(routine=>routine.title),
   })),
   routineCompleted:info.routineCompleted,
   routineScheduled:info.routineScheduled,
   recentActivity:info.recentActivity,
  }));
  const recentReviews=[...eveningReviews].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(review=>({date:review.date,status:review.status||undefined,goal:review.goal,enjoyment:review.enjoyment,reason:review.reason,good:review.good,learned:review.learned,joy:review.joy,eveningGratitude:gratitudeArray(review.eveningGratitude).filter(Boolean)}));
  const peopleLines=aiIncludePeople?local.people.filter(person=>person.nextContact&&person.nextContact<=today).map(person=>`${person.name}: 다음 연락 ${person.nextContact}${person.tags.length?` · 태그 ${person.tags.join(", ")}`:""}`):undefined;
  return buildChatGptLifeStatePrompt(type,{
   nowLabel:now.toLocaleString("ko-KR"),
   date:currentDateKey,
   phase:operatingContext.phase,
   morning:{goal:operatingContext.morning.goal,enjoyment:local.enjoyment,gratitude:local.gratitude.filter(Boolean)},
   calendarState:operatingContext.calendar.state,
   events,
   todos:{
    completed:operatingContext.todos.completed,
    total:operatingContext.todos.total,
    incomplete:operatingContext.todos.incomplete.map(taskState),
    overdue:operatingContext.todos.overdue.map(taskState),
    carry:operatingContext.todos.carry.map(taskState),
    replanningReasons:operatingContext.replanning.reasons,
   },
   routines:todayRoutines,
   weeklyGoals:operatingContext.goals.weekly.map(goal=>goal.title),
   monthlyGoals:operatingContext.goals.monthly.map(goal=>goal.title),
   projects,
   focusProject:type==="project"?selectedProjectData?.name:undefined,
   recentRecords:timeline.slice(0,10).map(item=>({date:item.date,kind:item.kind,title:item.title,project:item.project,detail:item.note})),
   recentReviews,
   facts30d:{
    todoRate:personalIntelligence.todo.completionRate,
    carry:personalIntelligence.todo.carryCount,
    overdue:personalIntelligence.todo.overdue,
    routineRate:personalIntelligence.routine.completionRate,
    routineCompleted:personalIntelligence.routine.completed,
    routineScheduled:personalIntelligence.routine.scheduled,
    calendarAvailable:personalIntelligence.calendar.available,
    calendarCount:personalIntelligence.calendar.count,
    calendarMinutes:personalIntelligence.calendar.minutes,
    morningDays:personalIntelligence.records.morningDirections,
    reviewDays:personalIntelligence.records.eveningReviews,
    stalledProjects:personalIntelligence.projects.stalled.map(info=>info.project.name),
    strugglingRoutines:personalIntelligence.routine.struggling.slice(0,5).map(item=>`${item.title} ${item.completionRate}%`),
   },
   comparison30d:{
    todoRateDelta:personalIntelligence.comparison.todoRateDelta,
    carryDelta:personalIntelligence.comparison.carryDelta,
    overdueDelta:personalIntelligence.comparison.overdueDelta,
    calendarMinutesDelta:personalIntelligence.comparison.calendarMinutesDelta,
    morningDelta:personalIntelligence.comparison.morningDelta,
    reviewDelta:personalIntelligence.comparison.reviewDelta,
   },
   weekly:{
    todoRate:weeklyIntelligence.todo.total?Math.round(weeklyIntelligence.todo.completed/weeklyIntelligence.todo.total*100):0,
    incomplete:weeklyIntelligence.todo.incomplete.length,
    routineRate:weeklyIntelligence.routine.completionRate,
    calendarMinutes:weeklyIntelligence.calendar.minutes,
    projectActivity:weeklyIntelligence.projects.length,
   },
   monthly:{
    todoRate:monthlyIntelligence.todo.completionRate,
    incomplete:monthlyIntelligence.todo.incomplete.length,
    routineRate:monthlyIntelligence.routine.completionRate,
    calendarMinutes:monthlyIntelligence.calendar.minutes,
    projectActivity:monthlyIntelligence.projects.length,
   },
   peopleLines,
  });
 }
 function prepareAi(type:AiPromptType){setAiType(type)}
 async function openChatGPT(){
  const prompt=buildAiPrompt(aiType);
  window.open("https://chatgpt.com/","_blank","noopener,noreferrer");
  try{
   await navigator.clipboard.writeText(prompt);
   notify("현재 Life State를 복사했습니다. ChatGPT 입력창에 붙여넣어 주세요.","info");
  }catch{
   notify("클립보드 복사에 실패했습니다. 브라우저의 클립보드 권한을 확인해 주세요.","error");
  }
 }


 const planningRange=view==="monthly-plan"?getMonthRange(planningAnchor):getWeekRange(planningAnchor);
 const currentWeekRange=getWeekRange(todayKey());
 const currentMonthRange=getMonthRange(todayKey());
 const weeklyIntelligence=getWeeklySummary({weekStart:currentWeekRange.start,goals:local.goals,plans:local.plans,tasks:local.tasks,events:operationalEvents.map(event=>({id:event.id,title:event.title,start:event.start,end:event.end,context:event.calendarName})),projects:local.projects,reviews:local.reviews,recurringTasks:local.recurringTasks,recurringTaskCompletions:local.recurringTaskCompletions});
 const monthlyIntelligence=getMonthlySummary({month:currentMonthRange.start.slice(0,7),now,goals:local.goals,plans:local.plans,tasks:local.tasks,events:operationalEvents.map(event=>({id:event.id,title:event.title,start:event.start,end:event.end,calendarId:event.calendarId})),projects:local.projects,reviews:local.reviews,activities:local.activities,notes:local.notes,recurringTasks:local.recurringTasks,recurringTaskCompletions:local.recurringTaskCompletions});
 const personalIntelligence=getPersonalIntelligence({now,tasks:local.tasks,events:calendarReady&&!operationalCalendarError?operationalEvents.map(event=>({id:event.id,title:event.title,start:event.start,end:event.end})):undefined,contexts:local.contexts,projects:local.projects,goals:local.goals,reviews:local.reviews,plans:local.plans,preferences:local.personalInsightPreferences??[],recurringTasks:local.recurringTasks,recurringTaskCompletions:local.recurringTaskCompletions});
 const homeSummaryInput={state:local,events:operationalEvents.map(event=>({...event,contextId:eventContextId(event)})),date:currentDateKey,context:contextFilter};
 const homeSummary=getDailyHomeSummary(homeSummaryInput);
 async function setVisibleRoutineDefinitionsActive(isActive:boolean){
  const contextId=contextFilter==="ALL"?undefined:local.contexts.find(context=>context.key===contextFilter)?.id;
  const targets=local.recurringTasks.filter(task=>(contextFilter==="ALL"||task.contextId===contextId)&&routineSectionForTask(task)===routineSection&&task.isActive!==isActive);
  if(!targets.length){notify(isActive?"이미 모든 루틴이 활성화되어 있습니다.":"이미 모든 루틴이 중지되어 있습니다.","info");return}
  const updated=new Map<string,RecurringTaskDefinition>();
  for(const task of targets){
   let next={...task,isActive,updatedAt:new Date().toISOString()};
   try{next=await syncRecurringCalendar(next,task)}catch{notify(`${task.title}의 Google Calendar 연결 변경에 실패했습니다.`,"error");continue}
   updated.set(task.id,next);
  }
  if(!updated.size)return;
  setLocal(state=>({...state,recurringTasks:state.recurringTasks.map(task=>updated.get(task.id)??task)}));
  notify(isActive?"현재 목록의 루틴을 모두 시작했습니다.":"현재 목록의 루틴을 모두 중지했습니다.","info");
  if([...updated.values()].some(task=>task.calendarEventId||task.showOnCalendar))refreshCalendarData();
 }
 const morningBriefing=createMorningBriefing({date:currentDateKey,now,direction:{morningDate:local.morningDate,goal:local.goal},schedules:todayEvents.map(event=>({id:event.id,title:event.title,start:event.start,end:event.end,context:event.calendarName})),todos:contextTasks,projects:local.projects});
 const currentDailyRecord=getDailyRecord({date:currentDateKey,goal:local.goal,reason:"",enjoyment:local.enjoyment,gratitude:local.gratitude,tasks:contextTasks,events:todayEvents.map(event=>({id:event.id,title:event.title,start:event.start,end:event.end,context:event.calendarName})),projects:local.projects,reviews:local.reviews});
 const dailyContinuity=createDailyContinuity({date:currentDateKey,tasks:contextTasks,reviews:local.reviews,projects:local.projects});
 const proactiveReminders=createProactiveReminders({now,date:currentDateKey,events:morningBriefing.schedules,todos:contextTasks,projects:local.projects,directionComplete:morningBriefing.direction.isComplete,continuity:dailyContinuity,projectIntelligence,monthlySummary:monthlyIntelligence});
 const operatingContext=useMemo(()=>getOperatingContext({date:currentDateKey,now,calendarAvailable:calendarReady&&!operationalCalendarError,events:morningBriefing.schedules,tasks:local.tasks,projects:local.projects,goals:local.goals,morningBriefing,dailyRecord:currentDailyRecord,continuity:dailyContinuity,projectIntelligence,personalIntelligence,reminders:proactiveReminders,dismissedReminderIds:(local.operatingReminderPreferences??[]).map(item=>item.reminderId)}),[calendarReady,operationalCalendarError,currentDateKey,currentDailyRecord,dailyContinuity,local.goals,local.operatingReminderPreferences,local.projects,local.tasks,morningBriefing,now,personalIntelligence,proactiveReminders,projectIntelligence]);
 function saveEveningReview(){
  const next={...currentReview,reason:"",date:reviewDate,eveningGratitude:gratitudeArray(currentReview.eveningGratitude)};
  update("reviews",{...local.reviews,[reviewDate]:next});
  notify("저녁 리뷰를 저장했습니다.");
 }
 function carryContinuityTasks(taskIds:string[]){
  const ids=new Set(taskIds);
  update("tasks",local.tasks.map(task=>ids.has(task.id)?carryTaskForward(task,currentDateKey):task));
  notify(`${taskIds.length}개의 미완료 할 일을 오늘로 가져왔습니다.`);
 }
 const isHomeScheduleDone=(event:EventItem)=>!event.allDay&&new Date(event.end||event.start).getTime()<=now.getTime();
 const isHomeScheduleOngoing=(event:EventItem)=>!event.allDay&&!isHomeScheduleDone(event)&&new Date(event.start).getTime()<=now.getTime();
 const homeTodayScheduleBase=[...todayEvents].sort((a,b)=>Number(isHomeScheduleDone(a))-Number(isHomeScheduleDone(b))||a.start.localeCompare(b.start));
 const homeCurrentSchedule=homeTodayScheduleBase.find(event=>isHomeScheduleOngoing(event));
 const homeUpcomingSchedule=homeTodayScheduleBase.find(event=>!event.allDay&&!isHomeScheduleDone(event)&&new Date(event.start).getTime()>now.getTime())
  ??homeTodayScheduleBase.find(event=>event.allDay&&!isHomeScheduleDone(event));
 const homeNextSchedule=homeCurrentSchedule??homeUpcomingSchedule;
 const homeFeaturedScheduleKey=homeNextSchedule?`${homeNextSchedule.calendarId||""}-${homeNextSchedule.id}-${homeNextSchedule.start}`:"";
 const homeTodaySchedule=homeNextSchedule
  ? homeTodayScheduleBase.filter(event=>`${event.calendarId||""}-${event.id}-${event.start}`!==homeFeaturedScheduleKey)
  : homeTodayScheduleBase;
 const homePrimaryReminderCandidate=operatingContext.primaryReminder?.type==="current_event"?operatingContext.reminders.find(reminder=>reminder.type!=="current_event"):operatingContext.primaryReminder;
 const homePrimaryReminder=homePrimaryReminderCandidate?.type==="upcoming_event"?undefined:homePrimaryReminderCandidate;
 const homePeriodTaskVisible=(task:TaskItem)=>!task.done||task.doneAt?.slice(0,10)===currentDateKey;
 const taskScheduledDate=(task:TaskItem)=>task.scheduledAt?.slice(0,10)||"";
 const taskInPeriod=(task:TaskItem,start:string,end:string)=>{const date=taskScheduledDate(task);return Boolean(date&&date>=start&&date<=end)};
 const homeWeekTasks=contextTasks.filter(task=>task.bucket==="week"&&taskInPeriod(task,currentWeekRange.start,currentWeekRange.end)&&homePeriodTaskVisible(task)).sort((a,b)=>(a.sortOrder??Number.MAX_SAFE_INTEGER)-(b.sortOrder??Number.MAX_SAFE_INTEGER)||(a.scheduledAt||"").localeCompare(b.scheduledAt||""));
 const homeWeekRoutines=local.recurringTasks.filter(task=>task.isActive&&routineSectionForTask(task)==="weekly"&&(contextFilter==="ALL"||local.contexts.find(context=>context.key===contextFilter)?.id===task.contextId)).sort((a,b)=>(a.sortOrder??local.recurringTasks.indexOf(a))-(b.sortOrder??local.recurringTasks.indexOf(b)));
 const weeklyRoutineCompletionDate=(taskId:string)=>local.recurringTaskCompletions.filter(item=>item.recurringTaskId===taskId&&item.status==="done"&&item.occurrenceDate>=currentWeekRange.start&&item.occurrenceDate<=currentWeekRange.end).map(item=>item.occurrenceDate).sort().at(-1);
 const homeWeekEntries=[
  ...homeWeekTasks.map(task=>({id:`task-${task.id}`,title:task.title,routine:false as const,done:task.done,taskId:task.id})),
  ...homeWeekRoutines.map(task=>{const completedDate=weeklyRoutineCompletionDate(task.id);return {id:`routine-${task.id}`,title:task.title,routine:true as const,done:completedDate===currentDateKey,taskId:task.id,completedDate}}).filter(item=>!item.completedDate||item.completedDate===currentDateKey),
 ];
 const homeMonthTasks=contextTasks.filter(task=>task.bucket==="month"&&taskInPeriod(task,currentMonthRange.start,currentMonthRange.end)&&homePeriodTaskVisible(task)).sort((a,b)=>(a.sortOrder??Number.MAX_SAFE_INTEGER)-(b.sortOrder??Number.MAX_SAFE_INTEGER)||(a.scheduledAt||"").localeCompare(b.scheduledAt||""));
 function toggleHomePeriodTask(taskId:string){
  update("tasks",local.tasks.map(task=>task.id===taskId?{...task,done:!task.done,doneAt:task.done?undefined:currentDateKey}:task));
 }
 function addHomeTask(title:string,bucket:TaskBucket,contextId?:string){
  const clean=title.trim();if(!clean)return;
  const period=taskPeriodForBucket(bucket,currentDateKey);
  const resolvedContextId=contextId??"personal";
  const task:TaskItem={id:uid(),title:clean,done:false,bucket,scheduledAt:period.start?`${period.start}T00:00:00`:"",durationMinutes:0,syncCalendar:false,contextId:resolvedContextId,sortOrder:local.tasks.length,...(period.end?{dueDate:period.end}:{})};
  update("tasks",[...local.tasks,task]);
  notify(bucket==="today"?"오늘 할 일을 추가했습니다.":bucket==="week"?"이번 주 할 일을 추가했습니다.":bucket==="month"?"이번 달 할 일을 추가했습니다.":"언젠가 할 일을 추가했습니다.");
 }
 function addHomeRoutine(title:string,mode:"DAILY"|"WEEKDAYS"|"WEEKENDS"|"WEEKLY"|"BIWEEKLY",contextId?:string){
  const clean=title.trim();if(!clean)return;
  const resolvedContextId=contextId??"personal";
  const day=parseYmd(currentDateKey).getDay();
  const recurrence:RecurringTaskDefinition["recurrence"]=mode==="DAILY"?{type:"DAILY"}:mode==="WEEKDAYS"?{type:"WEEKDAYS"}:mode==="WEEKENDS"?{type:"WEEKLY",weekdays:[0,6],interval:1}:{type:"WEEKLY",weekdays:[day],interval:mode==="BIWEEKLY"?2:1};
  const timestamp=new Date().toISOString();
  const routine:RecurringTaskDefinition={id:uid(),title:clean,description:"",contextId:resolvedContextId,recurrence,startDate:currentDateKey,priority:"normal",showOnCalendar:false,isActive:true,createdAt:timestamp,updatedAt:timestamp,sortOrder:local.recurringTasks.length};
  update("recurringTasks",[...local.recurringTasks,routine]);
  notify("루틴을 추가했습니다.");
 }
 function toggleHomeWeeklyRoutine(taskId:string){
  const hasCurrentWeekCompletion=local.recurringTaskCompletions.some(item=>item.recurringTaskId===taskId&&item.status==="done"&&item.occurrenceDate>=currentWeekRange.start&&item.occurrenceDate<=currentWeekRange.end);
  if(hasCurrentWeekCompletion){
   update("recurringTaskCompletions",local.recurringTaskCompletions.filter(item=>!(item.recurringTaskId===taskId&&item.occurrenceDate>=currentWeekRange.start&&item.occurrenceDate<=currentWeekRange.end)));
   return;
  }
  update("recurringTaskCompletions",[...local.recurringTaskCompletions,{recurringTaskId:taskId,occurrenceDate:currentDateKey,status:"done",completedAt:new Date().toISOString()}]);
 }
 const upsertPlan=(plan:Plan)=>update("plans",[...local.plans.filter(item=>item.id!==plan.id),plan]);
 const upsertGoal=(goal:Goal)=>update("goals",[...local.goals.filter(item=>item.id!==goal.id),goal]);
 const viewTitles:Record<string,string>={
  home:"오늘",day:"하루 기록","weekly-plan":"이번 주 계획","monthly-plan":"이번 달 계획",calendar:"캘린더",routines:"루틴 관리",projects:"프로젝트",
  people:"관계",records:"전체 기록",analytics:"분석",activities:"활동 기록",
  notes:"노트",review:"리뷰",timeline:"타임라인",chapters:"삶의 시기",ai:"AI",settings:"설정",profile:"개인정보"
 };


 const groups=[
  {label:"",items:[{v:"home",t:"홈",icon:"⌂"}]},
  {label:"일정",items:[{v:"calendar",t:"캘린더",icon:"▦"}]},
  {label:"운영",items:[{v:"projects",t:"프로젝트",icon:"▤"},{v:"people",t:"관계",icon:"♙"}]},
  {label:"기록",items:[{v:"records",t:"기록",icon:"✎"}]},
  {label:"분석",items:[{v:"analytics",t:"분석",icon:"⌁"}]},
  {label:"연결",items:[{v:"ai",t:"ChatGPT 연결",icon:"✧"}]},
  {label:"",items:[{v:"settings",t:"설정",icon:"⚙"}]}
 ] as const;
 if(!hydrated)return <main className="jeongLoadingPage" aria-live="polite" aria-busy="true"><div className="jeongLoadingSeal" aria-hidden="true">整</div><strong>JEONG을 정리하고 있습니다.</strong><span>잠시만 기다려 주세요.</span></main>;
  return <div className={`lifeShell ${view==="review"?reviewStyles.reviewShell:""}`}>
  {showMorning&&<div className="overlay"><form className="morningCard" onSubmit={saveMorning}><div className="modalHead"><div><span>오늘 시작</span><h2>{greeting}</h2></div><button type="button" className="softBtn" onClick={()=>setShowMorning(false)}>나중에</button></div><label>오늘 목표<textarea required value={local.goal} onChange={e=>update("goal",e.target.value)}/></label><label>오늘 즐길 것<textarea value={local.enjoyment} onChange={e=>update("enjoyment",e.target.value)}/></label><fieldset><legend>감사 3가지</legend>{[0,1,2].map(i=><input key={i} value={local.gratitude[i]??""} onChange={e=>update("gratitude",local.gratitude.map((x,j)=>j===i?e.target.value:x))}/>)}</fieldset><button className="goldBtn">오늘 시작하기</button></form></div>}
  <JeongShellNavigation groups={groups} activeView={view} onNavigate={next=>navigateTo(next as View)}/>
  <main className={`contentArea ${themeStyles.themeScope} view-${view} ${view==="home"?homeStyles.homeScope:""} ${view==="review"?reviewStyles.reviewScope:""} ${pageLoading?"pageLoading":""}`}>{view==="home"?<HomeHero
   title={greeting} theme={theme}
   dateLabel={now.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"})} timeLabel={now.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}
   weatherLoading={weatherLoading} weatherIcon={weatherIcon(weather?.code??0)} weatherTemperature={weather?`${Math.round(weather.temperature)}°`:"—"} weatherLabel={weather?weatherLabel(weather.code):"날씨 확인 불가"} weatherDetail={weather?`${weather.location} · 체감 ${Math.round(weather.apparent)}°`:"위치 권한을 허용하면 날씨를 표시합니다."}
   onWeather={requestWeather} onSearch={()=>setSearchOpen(true)} onTheme={toggleTheme} onMenu={()=>setShowMorning(true)}
  />:<JeongHero
   title={viewTitles[view]??"JEONG"} isHome={false} isReview={view==="review"} theme={theme}
   dateLabel={now.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"})}
   timeLabel={now.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}
   weatherLoading={weatherLoading} weatherIcon={weatherIcon(weather?.code??0)} weatherTemperature={weather?`${Math.round(weather.temperature)}°`:"—"}
   weatherLabel={weather?weatherLabel(weather.code):"날씨 확인 불가"} weatherDetail={weather?`${weather.location} · 체감 ${Math.round(weather.apparent)}°`:"위치 권한을 허용하면 날씨를 표시합니다."}
   onWeather={requestWeather} onSearch={()=>setSearchOpen(true)} onTheme={toggleTheme} onMenu={()=>setShowMorning(true)}
  />}

  {view==="home"&&<>
   <div className={homeStyles.homeLayout}>
   <section className={homeStyles.workspace}>
    <header className={homeStyles.workspaceHeader}>
     <div><span>오늘의 운영</span></div>
     <div className={homeStyles.homeHeaderActions}>
      <button className={`goldBtn morningSaveButton ${local.morningDate===todayKey()?"saved":""}`} onClick={()=>setShowMorning(true)}>{local.morningDate===todayKey()?"아침 기록 수정":"오늘 아침 기록"}</button>
      <button className={`softBtn ${homeStyles.homeReviewQuickButton}`} onClick={()=>{setReviewDate(currentDateKey);navigateTo("review")}}>{currentDailyRecord.eveningReview?"리뷰 수정":"리뷰 작성"}</button>
     </div>
    </header>
    <div className={homeStyles.workspaceBody}>
     <aside className={homeStyles.dailyRail}>
      <label><span>운영 날짜</span><input type="date" value={dayDate} onChange={e=>{setDayDate(e.target.value);if(e.target.value!==todayKey())setView("day")}}/></label>
      <section className={homeStyles.railSchedule} aria-label="오늘 스케줄">
       <button type="button" className={homeStyles.railScheduleFocus} onClick={()=>homeNextSchedule?openEvent(homeNextSchedule):navigateTo("calendar")}>
        <span>{homeCurrentSchedule?"현재 일정":homeNextSchedule?"다음 일정":"일정 없음"}</span>
        {homeNextSchedule
         ? <><strong>{homeNextSchedule.title||"제목 없는 일정"}</strong><time>{homeNextSchedule.allDay?"종일":homeCurrentSchedule?`${eventTime24(homeNextSchedule.start)}–${eventTime24(homeNextSchedule.end)} · 진행 중`:`${eventTime24(homeNextSchedule.start)}–${eventTime24(homeNextSchedule.end)}`}</time></>
         : <strong>오늘 남은 일정이 없습니다.</strong>}
       </button>
       <header><span>오늘 스케줄</span><b>{homeTodaySchedule.length+(homeNextSchedule?1:0)}</b></header>
       <div>{homeTodaySchedule.map(event=>{const completed=isHomeScheduleDone(event);return <button type="button" key={`${event.calendarId||""}-${event.id}-${event.start}`} className={completed?homeStyles.completedSchedule:""} aria-label={`${event.title||"제목 없는 일정"}${completed?" · 종료":""}`} onClick={()=>openEvent(event)}><time>{event.allDay?"종일":eventTime(event.start)}</time><strong>{event.title||"제목 없는 일정"}</strong>{isHomeScheduleOngoing(event)&&<em>진행 중</em>}</button>})}{!homeTodaySchedule.length&&!homeNextSchedule&&<small>오늘 스케줄이 없습니다.</small>}</div>
      </section>
     </aside>
     <article className={homeStyles.operationPanel}>
      <div className={homeStyles.operationTitle}><span>Morning Direction</span><h2>오늘의 방향을 정합니다.</h2></div>
      {local.morningDate===todayKey()
       ? <div className={homeStyles.morningSummary}>
          <div><span>🎯 오늘의 목표</span><strong>{local.goal||"오늘의 목표를 기록해 주세요."}</strong></div>
          <div><span>💗 오늘 즐길 것</span><strong>{local.enjoyment||"오늘 누리고 싶은 것을 기록해 주세요."}</strong></div>
          <div className={homeStyles.gratitudeSummary}><span>🌿 감사</span><ol>{[0,1,2].map(index=><li key={index}><b>{index+1}.</b><em>{local.gratitude[index]?.trim()||"—"}</em></li>)}</ol></div>
         </div>
       : <div className={homeStyles.morningEmpty}><strong>오늘의 방향을 아직 기록하지 않았습니다.</strong><p>가장 중요한 목표와 오늘 누릴 것을 정하면 하루의 우선순위를 한눈에 볼 수 있어요.</p><button className="goldBtn" onClick={()=>setShowMorning(true)}>오늘 아침 기록하기</button></div>}
      <div className={homeStyles.periodTaskGrid} aria-label="주간 및 월간 할 일">
       <section className={homeStyles.periodTaskCard}>
        <div className={homeStyles.periodTaskHeader}><span>이번 주 할 일</span><strong>{homeWeekEntries.length}개</strong></div>
        <div className={homeStyles.periodTaskChecklist}>
         {homeWeekEntries.map(item=><button type="button" key={item.id} className={`${homeStyles.periodTaskCheckRow} ${item.done?homeStyles.done:""}`} role="checkbox" aria-checked={item.done} onClick={()=>item.routine?toggleHomeWeeklyRoutine(item.taskId):toggleHomePeriodTask(item.taskId)}><i aria-hidden="true">{item.done?"✓":""}</i><small>{item.title}{item.routine?" ↻":""}</small></button>)}
         {!homeWeekEntries.length&&<small className={homeStyles.periodTaskEmpty}>남은 주간 할 일이 없습니다.</small>}
        </div>
       </section>
       <section className={homeStyles.periodTaskCard}>
        <div className={homeStyles.periodTaskHeader}><span>이번 달 할 일</span><strong>{homeMonthTasks.length}개</strong></div>
        <div className={homeStyles.periodTaskChecklist}>
         {homeMonthTasks.map(task=><button type="button" key={task.id} className={`${homeStyles.periodTaskCheckRow} ${task.done?homeStyles.done:""}`} role="checkbox" aria-checked={task.done} onClick={()=>toggleHomePeriodTask(task.id)}><i aria-hidden="true">{task.done?"✓":""}</i><small>{task.title}</small></button>)}
         {!homeMonthTasks.length&&<small className={homeStyles.periodTaskEmpty}>남은 월간 할 일이 없습니다.</small>}
        </div>
       </section>
      </div>
      {homePrimaryReminder&&homePrimaryReminder.action!=="morning"&&<div className="briefBubble homeOperatingAction"><strong>{homePrimaryReminder.title}</strong><p>{homePrimaryReminder.message}</p><div><button className="softBtn" onClick={()=>homePrimaryReminder.action==="calendar"?navigateTo("calendar"):homePrimaryReminder.action==="tasks"?navigateTo("home"):homePrimaryReminder.action==="projects"?navigateTo("projects"):homePrimaryReminder.action==="morning"?setShowMorning(true):undefined}>확인하기</button><button className="softBtn" onClick={()=>update("operatingReminderPreferences",[...(local.operatingReminderPreferences??[]),{reminderId:homePrimaryReminder.id,dismissedAt:new Date().toISOString()}])}>숨기기</button>{operatingContext.replanning.needed&&<button className="softBtn" onClick={()=>{prepareAi("daily");navigateTo("ai")}}>ChatGPT와 다시 계획</button>}</div></div>}
      {dailyContinuity.carryOverCandidates.length>0&&<div className="briefBubble"><strong>이전부터 이어진 할 일 {dailyContinuity.carryOverCandidates.length}개</strong><p>{dailyContinuity.carryOverCandidates.slice(0,3).map(item=>`${item.title}${item.carryCount?` · ${item.carryCount}회 미룸`:""}`).join(" · ")}</p><button className="softBtn" onClick={()=>carryContinuityTasks(dailyContinuity.carryOverCandidates.map(item=>item.todoId))}>모두 오늘로 가져오기</button></div>}
     </article>
    </div>
   </section>
   <div className={homeStyles.homeTodoRail}>
    <HomeOperations summary={homeSummary} contexts={local.contexts} onAddTask={addHomeTask} onAddRoutine={addHomeRoutine} onEditTask={taskId=>{const task=local.tasks.find(item=>item.id===taskId);if(task)setEditingTask({...task})}} onDeleteTask={taskId=>{const task=local.tasks.find(item=>item.id===taskId);if(task)void removeTask(task)}} onToggleTask={taskId=>update("tasks",local.tasks.map(item=>item.id===taskId?{...item,done:!item.done,doneAt:item.done?undefined:todayKey()}:item))} onToggleRecurring={(taskId,occurrenceDate)=>setRecurringCompletion(taskId,occurrenceDate,"done")} onSetTasksDone={(taskIds,done)=>{const ids=new Set(taskIds);update("tasks",local.tasks.map(item=>ids.has(item.id)?{...item,done,doneAt:done?todayKey():undefined}:item))}} onSetRoutinesDone={(items,done)=>{const keys=new Set(items.map(item=>`${item.taskId}|${item.occurrenceDate}`));const remaining=local.recurringTaskCompletions.filter(item=>!keys.has(`${item.recurringTaskId}|${item.occurrenceDate}`));update("recurringTaskCompletions",done?[...remaining,...items.map(item=>({recurringTaskId:item.taskId,occurrenceDate:item.occurrenceDate,status:"done" as const,completedAt:new Date().toISOString()}))]:remaining)}}/>
   </div>
   <div className={homeStyles.homeProjectWide}><HomeProjectSummary summary={homeSummary} onNavigate={target=>navigateTo(target)}/></div>
   </div>
  </>}

  {(view==="weekly-plan"||view==="monthly-plan")&&<PlanningWorkspace
   horizon={view==="monthly-plan"?"MONTH":"WEEK"} range={planningRange}
   contexts={local.contexts} contextFilter={contextFilter} onContextFilter={setContextFilter}
   plans={local.plans} goals={local.goals} projects={local.projects} tasks={local.tasks}
   reviews={local.reviews}
   recurringTasks={local.recurringTasks} completions={local.recurringTaskCompletions} events={events}
   onNavigate={direction=>{const next=view==="monthly-plan"?(direction<0?getPreviousMonth(planningAnchor):getNextMonth(planningAnchor)):(direction<0?getPreviousWeek(planningAnchor):getNextWeek(planningAnchor));setPlanningAnchor(next.start)}}
   onUpsertPlan={upsertPlan} onUpsertGoal={upsertGoal} onRemoveGoal={id=>update("goals",local.goals.filter(goal=>goal.id!==id&&goal.parentGoalId!==id))}
  />}


  {view==="day"&&(()=>{
 const now=Date.now();
 const sorted=[...dayEvents].sort((a,b)=>new Date(a.start).getTime()-new Date(b.start).getTime());
 const upcoming=dayDate===todayKey()?sorted.find(e=>new Date(e.end).getTime()>now):undefined;
 const executionContextId=dayExecutionContext==="ALL"?undefined:local.contexts.find(context=>context.key===dayExecutionContext)?.id;
 const allDayTasks=local.tasks.filter(t=>(t.scheduledAt?.slice(0,10)||"")===dayDate||(t.bucket==="today"&&((!t.done&&dayDate===todayKey())||(t.done&&t.doneAt===dayDate))));
 const filteredDayTasks=allDayTasks.filter(task=>!executionContextId||task.contextId===executionContextId).sort((a,b)=>Number(a.done)-Number(b.done)||(a.sortOrder??Number.MAX_SAFE_INTEGER)-(b.sortOrder??Number.MAX_SAFE_INTEGER)||a.title.localeCompare(b.title));
 const remainingTasks=allDayTasks.filter(t=>!t.done);
 const dayRoutines=getOccurrencesForDate(local.recurringTasks,dayDate,local.recurringTaskCompletions)
  .filter(item=>!executionContextId||item.task.contextId===executionContextId)
  .sort((a,b)=>Number(a.status==="done")-Number(b.status==="done")||(a.task.sortOrder??Number.MAX_SAFE_INTEGER)-(b.task.sortOrder??Number.MAX_SAFE_INTEGER)||a.task.title.localeCompare(b.task.title));
 const executionRows=dayExecutionMode==="todos"?filteredDayTasks:dayRoutines;
 const executionDone=dayExecutionMode==="todos"?filteredDayTasks.filter(item=>item.done).length:dayRoutines.filter(item=>item.status==="done").length;
 const dayGoal=dayDate===todayKey()?(local.goal||dayReview?.goal):(dayReview?.goal||"");
 const dayEnjoyment=dayDate===todayKey()?(local.enjoyment||dayReview?.enjoyment):(dayReview?.enjoyment||"");
 return <div className="dayWorkspace">
  <section className="dayHero premiumCard">
   <div className="dayHeroCopy">
    <span>{dayDate===todayKey()?"오늘의 흐름":"하루 기록"}</span>
    <h2>{dayDate===todayKey()?"오늘을 한눈에 봅니다.":`${dayDate}의 기록`}</h2>
    <p>{dayEvents.length}개 일정 · {remainingTasks.length}개 남은 할 일 · 루틴 {getOccurrencesForDate(local.recurringTasks,dayDate,local.recurringTaskCompletions).filter(item=>item.status==="done").length}/{getOccurrencesForDate(local.recurringTasks,dayDate,local.recurringTaskCompletions).length} · {dayActivities.length}개 활동 기록</p>
   </div>
   <div className="dayHistoryControls"><label className="dayDateControl"><span>날짜</span><input type="date" value={dayDate} max={todayKey()} onChange={e=>setDayDate(e.target.value)}/></label><button onClick={()=>{setDayDate(todayKey());navigateTo("home")}}>오늘로 돌아가기</button></div>
  </section>

  <section className="dayMainGrid">
   <div className="dayLeftColumn">
    <article className="premiumCard dayCompactCard">
     <div className="dayCardHead"><div><span>아침</span><h3>오늘의 방향</h3></div>{dayDate===todayKey()&&<button onClick={()=>navigateTo("home")}>수정</button>}</div>
     <div className="directionRows">
      <div><b>목표</b><p>{dayGoal||"기록 없음"}</p></div>
      <div><b>즐길 것</b><p>{dayEnjoyment||"기록 없음"}</p></div>
     </div>
    </article>

    <article className="premiumCard dayCompactCard reviewCard">
     <div className="dayCardHead"><div><span>저녁</span><h3>하루 리뷰</h3></div><button onClick={()=>{setReviewDate(dayDate);navigateTo("review")}}>{dayReview?"열기":"작성"}</button></div>
     {dayReview?<div className="reviewPreview"><p><b>잘한 점</b>{dayReview.good||"—"}</p><p><b>배운 점</b>{dayReview.learned||"—"}</p><p><b>즐거웠던 순간</b>{dayReview.joy||"—"}</p></div>:<button className="dayEmptyAction" onClick={()=>{setReviewDate(dayDate);navigateTo("review")}}>이 날의 리뷰 작성하기</button>}
    </article>

    <article className="premiumCard dayCompactCard dayExecutionCard">
     <div className="dayCardHead dayExecutionHead"><div><span>실행</span><h3>{dayExecutionMode==="todos"?"이 날의 할 일":"이 날의 루틴"}</h3></div><small>{executionDone}/{executionRows.length} 완료</small></div>
     <div className="dayExecutionTabs" role="tablist" aria-label="할 일과 루틴 전환">
      <button type="button" role="tab" aria-selected={dayExecutionMode==="todos"} className={dayExecutionMode==="todos"?"active":""} onClick={()=>setDayExecutionMode("todos")}>할 일 <span>{filteredDayTasks.length}</span></button>
      <button type="button" role="tab" aria-selected={dayExecutionMode==="routines"} className={dayExecutionMode==="routines"?"active":""} onClick={()=>setDayExecutionMode("routines")}>루틴 <span>{dayRoutines.length}</span></button>
     </div>
     <div className="dayExecutionContext"><ContextFilter contexts={local.contexts} value={dayExecutionContext} onChange={setDayExecutionContext} ariaLabel="과거 날짜 실행 맥락 필터"/></div>
     <div className="dayList dayExecutionList">
      {dayExecutionMode==="todos"&&filteredDayTasks.map(t=><div className={`dayExecutionRow ${t.done?"done":""}`} key={t.id}>
       <button type="button" className="dayExecutionToggle" role="checkbox" aria-checked={t.done} aria-label={`${t.title} ${t.done?"미완료로 변경":"완료 처리"}`} onClick={()=>update("tasks",local.tasks.map(x=>x.id===t.id?{...x,done:!x.done,doneAt:x.done?undefined:dayDate}:x))}><i aria-hidden="true">{t.done?"✓":""}</i><span>{t.title}</span><small>{t.done?"완료":"할 일"}</small></button>
      </div>)}
      {dayExecutionMode==="routines"&&dayRoutines.map(item=><button type="button" key={`${item.task.id}-${item.occurrenceDate}`} className={`dayExecutionToggle dayRoutineToggle ${item.status==="done"?"done":""}`} role="checkbox" aria-checked={item.status==="done"} onClick={()=>setRecurringCompletion(item.task.id,item.occurrenceDate,"done")}><i aria-hidden="true">{item.status==="done"?"✓":""}</i><span>{item.task.title}</span><small>{item.status==="done"?"완료":describeRecurrence(item.task)}</small></button>)}
      {!executionRows.length&&<p className="dayEmptyText">{dayExecutionMode==="todos"?"이 날짜에 기록된 할 일이 없습니다.":"이 날짜에 예정된 루틴이 없습니다."}</p>}
     </div>
    </article>
   </div>

   <div className="dayRightColumn">
    <article className="premiumCard dayScheduleCard">
     <div className="dayCardHead"><div><span>일정</span><h3>스케줄</h3></div><button onClick={()=>navigateTo("calendar")}>캘린더</button></div>
     {upcoming&&<div className="nextSchedule"><span>{new Date(upcoming.start).getTime()<=now?"진행 중":"다음 일정"}</span><strong>{upcoming.title}</strong><p>{eventTime(upcoming.start)}{upcoming.location?` · ${upcoming.location}`:""}</p></div>}
     <div className="scheduleTimeline">
      {sorted.map(e=>{
       const end=new Date(e.end).getTime();
       const start=new Date(e.start).getTime();
       const state=dayDate<todayKey()?"past":end<=now?"past":start<=now?"current":"future";
       return <button className={`scheduleRow ${state}`} key={`${e.calendarId||""}-${e.id}-${e.start}`} onClick={()=>openEvent(e)}><time>{eventTime(e.start)}</time><span>{e.title}</span><b>{state==="past"?"완료":state==="current"?"진행 중":"예정"}</b></button>
      })}
      {!sorted.length&&<button className="dayEmptyAction" onClick={()=>navigateTo("calendar")}>이 날짜에는 일정이 없습니다.</button>}
     </div>
    </article>
   </div>
  </section>
 </div>
})()}

  {view==="calendar"&&<div className="calendarWorkspace"><section className="premiumCard calendarPage"><div className="calendarCompactHeader">
    <div><span>시간</span><h2>{calendarMode==="week"?"주간 시간":calendarMode==="month"?"월간 시간":"하루 시간"}</h2></div>
    <ContextFilter contexts={local.contexts} value={contextFilter} onChange={setContextFilter}/>
    <div className="calendarHeaderHint">
 {calendarMode==="month"?"날짜를 눌러 관리 · 일정 문구를 눌러 수정":calendarMode==="week"?"일정 카드를 눌러 수정 · 요일을 눌러 날짜 관리":"일정을 눌러 수정·삭제"}
</div>
   </div>
   <details className="eventOptionSection">
    <summary>캘린더 분류 관리</summary>
    <div className={planningContextStyles.mapping}>
     {calendarOptions.map(calendar=>{
      const contextId=getCalendarContextId(local.calendarContextMappings,calendar.id);
      return <div className={planningContextStyles.mappingRow} key={calendar.id}>
       <strong>{calendar.name}</strong>
       <ContextPicker contexts={local.contexts} value={contextId} onChange={value=>setCalendarContext(calendar.id,value)} label="맥락"/>
       {contextId&&<label>기본 캘린더 <input type="radio" name={`default-${contextId}`} checked={local.contextCalendarPreferences.some(preference=>preference.contextId===contextId&&preference.defaultCalendarId===calendar.id)} onChange={()=>setDefaultContextCalendar(contextId,calendar.id)}/></label>}
      </div>})}
    </div>
   </details>
   <div className="calendarToolbar compactToolbar">
    <div className="calendarPrimaryControls"><button onClick={()=>{const n=new Date();setCursor(n);setSelectedDate(n)}}>오늘</button><button onClick={()=>{const d=new Date(cursor);calendarMode==="month"?d.setMonth(d.getMonth()-1):calendarMode==="week"?d.setDate(d.getDate()-7):d.setDate(d.getDate()-1);setCursor(d)}}>‹</button><button onClick={()=>{const d=new Date(cursor);calendarMode==="month"?d.setMonth(d.getMonth()+1):calendarMode==="week"?d.setDate(d.getDate()+7):d.setDate(d.getDate()+1);setCursor(d)}}>›</button><strong>{cursor.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:calendarMode==="day"?"numeric":undefined})}</strong></div>
    <div className={`calendarCenterControls ${calendarMode==="day"?"isReserved":""}`} aria-hidden={calendarMode==="day"}><div className="monthDisplayTabs">{calendarMode==="month"?<><button className={monthDisplay==="calendar"?"active":""} onClick={()=>setMonthDisplay("calendar")}>달력</button><button className={monthDisplay==="list"?"active":""} onClick={()=>setMonthDisplay("list")}>목록</button></>:calendarMode==="week"?<><button className={weekDisplay==="calendar"?"active":""} onClick={()=>setWeekDisplay("calendar")}>보드</button><button className={weekDisplay==="list"?"active":""} onClick={()=>setWeekDisplay("list")}>목록</button></>:null}</div></div>
    <div className="calendarSecondaryControls"><div className="calendarModeTabs"><button className={calendarMode==="month"?"active":""} onClick={()=>setCalendarMode("month")}>월</button><button className={calendarMode==="week"?"active":""} onClick={()=>setCalendarMode("week")}>주</button><button className={calendarMode==="day"?"active":""} onClick={()=>setCalendarMode("day")}>일</button></div><button className="goldBtn" onClick={()=>openNewEvent(calendarMode==="day"?cursor:selectedDate)}>+ 일정 추가</button></div>
   </div>
   {calendarError&&<p className="calendarError">{calendarError}</p>}
   {calendarMode==="month"&&monthDisplay==="calendar"&&<div className="monthCalendar"><div className="weekHeader">{["일","월","화","수","목","금","토"].map(x=><span key={x}>{x}</span>)}</div><div className="monthGrid">{monthDays(cursor).map(d=>{
    const key=todayKey(d);const de=contextEvents.filter(e=>eventOccursOnDate(e,key));
    return <button key={d.toISOString()} className={`${d.getMonth()!==cursor.getMonth()?"outside":""} ${key===selectedDateKey?"selected":""} ${key===todayKey()?"todayCell":""}`}
    onClick={()=>{setSelectedDate(d);setCalendarDayPreview(d)}}>
     <b>{d.getDate()}</b>{de.slice(0,3).map(e=><span className={`calendarEventTone context-${eventTone(e)}`} key={e.id} title={`${eventTime(e.start)} ${e.title}`} onClick={ev=>{ev.stopPropagation();setSelectedDate(d);openEvent(e)}} aria-label={`${e.title} 일정 수정`}>{eventTime(e.start)} {e.title}</span>)}{de.length>3&&<small>+{de.length-3}개</small>}
    </button>})}</div></div>}

   {calendarMode==="month"&&monthDisplay==="list"&&<section className="monthListView">
    <div className="monthListTools">
     <input value={monthSearch} onChange={e=>setMonthSearch(e.target.value)} placeholder="이번 달 일정 검색"/>
     <select value={monthStatus} onChange={e=>setMonthStatus(e.target.value as typeof monthStatus)}>
      <option value="all">전체 상태</option><option value="planned">예정</option><option value="doing">진행 중</option><option value="done">완료</option>
     </select>
     <strong>{monthEvents.length}개 일정</strong>
    </div>
    <div className="monthAgendaList">
     {Object.entries(monthEventGroups).map(([date,items])=><section key={date}>
      <header><div><span>{new Date(`${date}T00:00:00`).toLocaleDateString("ko-KR",{weekday:"short"})}</span><h3>{new Date(`${date}T00:00:00`).toLocaleDateString("ko-KR",{month:"long",day:"numeric"})}</h3></div><button onClick={()=>openNewEvent(new Date(`${date}T00:00:00`))}>+ 일정</button></header>
      <div>{items.map(e=><article className={`calendarEventTone context-${eventTone(e)}`} key={`${e.calendarId||""}-${e.id}`} onClick={()=>openEvent(e)} role="button" tabIndex={0}>
       <time>{e.allDay?"종일":eventTime(e.start)}</time>
       <div><strong>{e.title}</strong><small>{[e.location,e.calendarName].filter(Boolean).join(" · ")||"세부 정보 없음"}</small></div>
       <span className={`monthListStatus ${eventStatus(e)==="완료"?"done":eventStatus(e)==="진행 중"?"doing":"planned"}`}>{eventStatus(e)}</span>
      </article>)}</div>
     </section>)}
     {!monthEvents.length&&<div className="monthListEmpty"><strong>조건에 맞는 일정이 없습니다.</strong><button onClick={()=>openNewEvent(new Date(cursor.getFullYear(),cursor.getMonth(),1))}>이번 달 첫 일정 추가</button></div>}
    </div>
   </section>}
   {calendarMode==="week"&&weekDisplay==="calendar"&&<div className="weekAgenda">
 {weekDates.map(d=>{
  const dayItems=agendaDayEvents(d);
  const key=todayKey(d);
  return <section key={key} className={`weekDayColumn ${key===todayKey()?"today":""}`}>
   <button className="weekDayHead" onClick={()=>{setSelectedDate(d);setCalendarDayPreview(d)}}>
    <span>{d.toLocaleDateString("ko-KR",{weekday:"short"})}</span>
    <strong>{d.getDate()}</strong>
    <small>{dayItems.length}개</small>
   </button>
   <div className="weekDayEvents">
    {dayItems.map(e=><article className={`calendarEventTone context-${eventTone(e)}`} key={`${e.calendarId||""}-${e.id}-${e.start}`} onClick={()=>openEvent(e)} role="button" tabIndex={0} title="눌러서 일정 수정·삭제" onKeyDown={ev=>{if(ev.key==="Enter")openEvent(e)}}>
     <div className="weekEventContent">
      <strong>{e.title||"제목 없는 일정"}</strong>
      <time>{e.allDay?"종일":eventTime(e.start)}</time>
      {e.location&&<small>{e.location}</small>}
     </div>
     <span className={`weekEventStatus ${eventStatus(e)==="완료"?"done":eventStatus(e)==="진행 중"?"doing":"planned"}`}>{eventStatus(e)}</span>
    </article>)}
    {!dayItems.length&&<button className="emptyWeekDay" onClick={()=>openNewEvent(d)}>+ 일정</button>}
   </div>
  </section>
 })}
</div>}
   {calendarMode==="week"&&weekDisplay==="list"&&<section className="monthListView weekListView"><div className="monthListTools"><strong>이번 주 남은 일정 {Object.values(weekListGroups).flat().length}개</strong></div><div className="monthAgendaList">{Object.entries(weekListGroups).map(([date,items])=><section key={date}><header><div><span>{new Date(`${date}T00:00:00`).toLocaleDateString("ko-KR",{weekday:"short"})}</span><h3>{new Date(`${date}T00:00:00`).toLocaleDateString("ko-KR",{month:"long",day:"numeric"})}</h3></div><button onClick={()=>setSelectedDate(new Date(`${date}T00:00:00`))}>상세 보기</button></header><div>{items.map(event=><article className={`calendarEventTone context-${eventTone(event)}`} key={`${event.calendarId||""}-${event.id}-${event.start}`} onClick={()=>openEvent(event)} role="button" tabIndex={0}><time>{event.allDay?"종일":`${eventTime(event.start)} – ${eventTime(event.end||event.start)}`}</time><div><strong>{event.title||"제목 없는 일정"}</strong><small>{[event.location,event.calendarName].filter(Boolean).join(" · ")||"추가 정보 없음"}</small></div></article>)}</div></section>)}{!Object.keys(weekListGroups).length&&<div className="monthListEmpty"><strong>이번 주에 남은 일정이 없습니다.</strong></div>}</div></section>}
{calendarMode==="day"&&<div className="dayAgenda">
 <div className="dayAgendaHead"><div><span>{cursor.toLocaleDateString("ko-KR",{weekday:"long"})}</span><h2>{cursor.toLocaleDateString("ko-KR",{month:"long",day:"numeric"})}</h2></div><b>{dayModeEvents.length}개 일정</b></div>
 <div className="agendaView">{dayModeEvents.map(e=><article className={`calendarEventTone context-${eventTone(e)}`} key={`${e.calendarId||""}-${e.id}-${e.start}`} onClick={()=>openEvent(e)} role="button" tabIndex={0} title="눌러서 일정 수정·삭제" onKeyDown={ev=>{if(ev.key==="Enter")openEvent(e)}}><time>{e.allDay?"종일":eventTime(e.start)}</time><div><strong>{e.title||"제목 없는 일정"}</strong><small>{e.location||"세부 정보 없음"}</small></div><span>{eventStatus(e)}</span></article>)}{!dayModeEvents.length&&<button className="emptyDayEvent" onClick={()=>openNewEvent(cursor)}>이 날짜에는 일정이 없습니다.<br/><b>새 일정 추가</b></button>}</div>
</div>}
  </section>
  <aside className="premiumCard selectedDayPanel taskSidePanel">
   <div className="selectedDayHead">
    <div className="selectedDayIdentity"><span>할 일</span><h2>{calendarPanelDate.toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"long"})}</h2><small>캘린더는 스케줄, 오른쪽은 할 일만 표시합니다.</small></div>
    <button className="selectedDayAddBtn" onClick={()=>navigateTo("home")}>홈에서 추가</button>
   </div>
   <div className="selectedDayRangeTabs" role="tablist" aria-label="할 일 범위">
    <button type="button" className={calendarTaskRange==="day"?"active":""} aria-selected={calendarTaskRange==="day"} onClick={()=>setCalendarTaskRange("day")}>하루</button>
    <button type="button" className={calendarTaskRange==="week"?"active":""} aria-selected={calendarTaskRange==="week"} onClick={()=>setCalendarTaskRange("week")}>주</button>
    <button type="button" className={calendarTaskRange==="month"?"active":""} aria-selected={calendarTaskRange==="month"} onClick={()=>setCalendarTaskRange("month")}>달</button>
   </div>
   <section className="selectedRangeTasks calendarTaskPanel" aria-live="polite">
    <header><span>{calendarTaskRange==="day"?"하루 할 일":calendarTaskRange==="week"?"이번 주 할 일":"이번 달 할 일"}</span><b>{selectedPanelTasks.length}개</b></header>
    <div>
     {selectedPanelTasks.map(task=><div className={`dayTaskRow ${task.done?"done":""}`} key={task.id}><button type="button" className={`dayTaskToggle ${task.done?"checked":""}`} role="checkbox" aria-checked={task.done} aria-label={`${task.title} ${task.done?"미완료로 변경":"완료 처리"}`} onClick={()=>update("tasks",local.tasks.map(item=>item.id===task.id?{...item,done:!item.done,doneAt:item.done?undefined:calendarTodoDateKey}:item))}><span aria-hidden="true">{task.done?"✓":""}</span></button><span>{task.title}</span></div>)}
     {!selectedPanelTasks.length&&<p className="selectedGoalEmpty">{calendarTaskRange==="day"?"오늘 남은 할 일이 없습니다.":calendarTaskRange==="week"?"이번 주 남은 할 일이 없습니다.":"이번 달 남은 할 일이 없습니다."}</p>}
    </div>
   </section>
  </aside>
 </div>}



  {view==="routines"&&<>
   <section className="premiumCard taskComposer compactTaskComposer oneLineTaskComposer hasRecurringQuick">
    <input className="taskTitleField" value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="루틴을 입력하세요"/>
    <select className="taskProjectField" value={taskProject} onChange={e=>setTaskProject(e.target.value)} aria-label="프로젝트"><option value="">프로젝트 없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <div className="taskContextField"><ContextPicker contexts={local.contexts} label="맥락" value={taskContext} onChange={value=>setTaskContext(value??"personal")} allowUnassigned={false}/></div>
    <button className="goldBtn taskAddBtn" onClick={saveRoutineDefinition}>{editingRecurringId?"수정 완료":"루틴 추가"}</button>
    <textarea className="taskMemoField" value={taskMemo} onChange={e=>setTaskMemo(e.target.value)} placeholder="메모 (선택)"/>
    <div className="taskRecurringQuick"><label><span>루틴 주기</span><select value={taskRepeatMode} onChange={e=>setRoutineMode(e.target.value as typeof taskRepeatMode)}><option value="DAILY">매일</option><option value="WEEKDAYS">평일</option><option value="WEEKENDS">주말</option><option value="WEEKLY">매주 요일</option><option value="WEEKLY_BLOCKS">주간 구간</option><option value="BIWEEKLY">격주</option></select></label>{taskRepeatMode==="WEEKLY_BLOCKS"&&<div className="routineBlockEditor"><span>주간 실행 구간</span>{taskRepeatBlocks.map((block,index)=><div key={index}><select value={block.startDay} onChange={e=>setTaskRepeatBlocks(rows=>rows.map((row,i)=>i===index?{...row,startDay:Number(e.target.value)}:row))}>{[[1,"월"],[2,"화"],[3,"수"],[4,"목"],[5,"금"],[6,"토"],[0,"일"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><b>~</b><select value={block.endDay} onChange={e=>setTaskRepeatBlocks(rows=>rows.map((row,i)=>i===index?{...row,endDay:Number(e.target.value)}:row))}>{[[1,"월"],[2,"화"],[3,"수"],[4,"목"],[5,"금"],[6,"토"],[0,"일"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><input type="number" min="1" max="7" value={block.target} onChange={e=>setTaskRepeatBlocks(rows=>rows.map((row,i)=>i===index?{...row,target:Math.max(1,Number(e.target.value)||1)}:row))}/><em>회</em><button type="button" onClick={()=>setTaskRepeatBlocks(rows=>rows.filter((_,i)=>i!==index))}>×</button></div>)}<button type="button" onClick={()=>setTaskRepeatBlocks(rows=>[...rows,{startDay:1,endDay:0,target:1}])}>＋ 구간 추가</button><small>각 구간의 목표 횟수를 채우면 그 구간이 끝날 때까지 다시 나타나지 않습니다. 다음 주에는 같은 구간으로 새로 시작합니다.</small></div>}{(taskRepeatMode==="WEEKLY"||taskRepeatMode==="BIWEEKLY")&&<div className="routineWeekdayField"><span>반복 요일</span><div className="routineWeekdayPicker">{[[0,"일"],[1,"월"],[2,"화"],[3,"수"],[4,"목"],[5,"금"],[6,"토"]].map(([day,label])=><button type="button" key={day} className={taskRepeatWeekdays.includes(day as number)?"selected":""} onClick={()=>toggleRoutineWeekday(day as number)}>{label}</button>)}</div></div>}<small>루틴 정의는 여기서 수정·중지·재시작·삭제합니다.</small></div>
   </section>
   <section className="premiumCard taskBoardCard">
    <div className="cardTitle taskBoardTopToolbar"><ContextFilter contexts={local.contexts} value={contextFilter} onChange={setContextFilter}/><div className="routineScopeTabs" role="tablist" aria-label="루틴 구분"><button type="button" role="tab" aria-selected={routineSection==="daily"} className={routineSection==="daily"?"active":""} onClick={()=>setRoutineSection("daily")}>루틴</button><button type="button" role="tab" aria-selected={routineSection==="weekly"} className={routineSection==="weekly"?"active":""} onClick={()=>setRoutineSection("weekly")}>주간 루틴</button></div></div>
    <div className="taskTabs"><div className="routineBulkActions" aria-label="루틴 전체 상태 변경"><button type="button" onClick={()=>setVisibleRoutineDefinitionsActive(true)}>전체 시작</button><button type="button" onClick={()=>setVisibleRoutineDefinitionsActive(false)}>전체 중지</button></div></div>
    <div className="rows recurringDefinitionRows">{local.recurringTasks.filter(task=>(contextFilter==="ALL"||local.contexts.find(context=>context.key===contextFilter)?.id===task.contextId)&&routineSectionForTask(task)===routineSection).sort((a,b)=>(a.sortOrder??local.recurringTasks.indexOf(a))-(b.sortOrder??local.recurringTasks.indexOf(b))).map(task=><article key={task.id} draggable onDragStart={()=>setDraggingRecurringId(task.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(draggingRecurringId)reorderRecurringTask(draggingRecurringId,task.id);setDraggingRecurringId(null)}}><button type="button" className={`taskCheck ${task.isActive?"checked":""}`} role="checkbox" aria-checked={task.isActive} aria-label={`${task.title} ${task.isActive?"루틴 중지":"루틴 시작"}`} onClick={()=>setRecurringActive(task,!task.isActive)}><span>{task.isActive?"✓":""}</span></button><span className="taskDragHandle" title="끌어서 순서 변경">⋮⋮</span><div><strong>{task.title}</strong><ContextTag contexts={local.contexts} contextId={task.contextId}/><small>{describeRecurrence(task)} · {routineSectionForTask(task)==="weekly"?"주간 루틴":"루틴"}{!task.isActive?" · 중지됨":""}</small>{task.description&&<p className="taskNotePreview">{task.description}</p>}</div><div className="taskRowActions routineRowActions"><button className="taskEditBtn" aria-label="루틴 수정" title="수정" onClick={()=>editRecurringInline(task)}><span aria-hidden="true">✎</span><em>수정</em></button><button className="taskPauseBtn" aria-label={task.isActive?"루틴 중지":"루틴 다시 시작"} title={task.isActive?"중지":"다시 시작"} onClick={()=>setRecurringActive(task,!task.isActive)}><span aria-hidden="true">{task.isActive?"■":"▶"}</span><em>{task.isActive?"중지":"시작"}</em></button><button className="taskDeleteBtn" aria-label="루틴 삭제" title="삭제" onClick={()=>removeRecurringTask(task)}><span aria-hidden="true">×</span><em>삭제</em></button></div></article>)}{!local.recurringTasks.some(task=>(contextFilter==="ALL"||local.contexts.find(context=>context.key===contextFilter)?.id===task.contextId)&&routineSectionForTask(task)===routineSection)&&<p>{routineSection==="weekly"?"등록된 주간 루틴이 없습니다.":"등록된 루틴이 없습니다."}</p>}</div>
   </section>
  </>}

  {view==="projects"&&<div className="projectWorkspace">
 <aside className="premiumCard projectList">
  <div className="cardTitle"><div><h2>프로젝트</h2><small>{local.projects.length}개 운영 중</small></div><button className="iconAddBtn" title="새 프로젝트" onClick={()=>setProjectDialog("project")}>＋</button></div>
  <div className="projectListItems">{local.projects.map(p=>{
   return <button className={selectedProject===p.id?"active":""} onClick={()=>{setSelectedProject(p.id);setProjectEditing(false)}} key={p.id}>
    <div className="projectListTop"><strong>{p.name}</strong><span className="projectListStatusProgress"><small className={`statusBadge ${p.status}`}>{projectStatusLabel[p.status]}</small><b>{projectProgressNeedsPeriod(p)?"기간 필요":`${projectProgressValue(p)}%`}</b></span></div>
    <div className="projectListMeta"><small>{formatProjectPeriod(p)}{getProjectDday(p.dueDate)!==undefined?` · ${getProjectDday(p.dueDate)!>=0?`D-${getProjectDday(p.dueDate)}`:`D+${Math.abs(getProjectDday(p.dueDate)!)}`}`:""}</small></div>
    <div className="miniProgress"><i style={{width:`${projectProgressValue(p)}%`}}></i></div>
   </button>
  })}</div>
 </aside>

 {selectedProjectData&&<section className="premiumCard projectDetail redesignedProject">
  <header className="projectHero">
   <div className="projectIdentity">
    <div className="projectIdentityTitleRow">
     {projectEditing?<input className="projectNameInput" value={selectedProjectData.name} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,name:e.target.value}:p))}/>:<h2>{selectedProjectData.name}</h2>}
     {projectEditing
      ? <select className="projectStatusInlineSelect" aria-label="프로젝트 상태" value={selectedProjectData.status} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?withProjectStatus(p,e.target.value as Project["status"]):p))}><option value="planning">기획</option><option value="active">진행 중</option><option value="review">검토 중</option><option value="done">완료</option></select>
      : <span className={`statusBadge ${selectedProjectData.status}`}>{projectStatusLabel[selectedProjectData.status]}</span>}
    </div>
    <div className={`projectGoalSummary ${projectEditing?"editing":""}`}><span>목표</span>{projectEditing?<textarea className="projectGoalInlineInput" aria-label="프로젝트 목표" value={selectedProjectData.goal} placeholder="프로젝트가 끝났을 때 만들어낼 결과" onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,goal:e.target.value}:p))}/>:<strong>{selectedProjectData.goal||"프로젝트 목표를 입력해 주세요."}</strong>}</div>
    <div className={`projectPeriod ${projectEditing?"editing":""}`}><span className="projectPeriodLabel">기간</span><div className="projectPeriodDates">{projectEditing?<><label className="projectInlineDate"><span>시작</span><input type="date" value={selectedProjectData.startDate??""} onChange={e=>updateProjectPeriod(selectedProjectData.id,e.target.value||undefined,selectedProjectData.dueDate)}/></label><label className="projectInlineDate"><span>마감</span><input type="date" min={selectedProjectData.startDate??undefined} value={selectedProjectData.dueDate??""} onChange={e=>updateProjectPeriod(selectedProjectData.id,selectedProjectData.startDate,e.target.value||undefined)}/></label></>:<><strong>시작 {selectedProjectData.startDate?.replaceAll("-",".")||"미정"}</strong><strong>마감 {selectedProjectData.dueDate?.replaceAll("-",".")||"미정"}</strong></>}</div>{getProjectDday(selectedProjectData.dueDate)!==undefined?<b className="projectDdayBadge">{getProjectDday(selectedProjectData.dueDate)!>=0?`D-${getProjectDday(selectedProjectData.dueDate)}`:`D+${Math.abs(getProjectDday(selectedProjectData.dueDate)!)}`}</b>:null}</div>
   </div>
   <div className="projectProgressSummary">
    <b>{projectProgressNeedsPeriod(selectedProjectData)?"—":`${projectProgressValue(selectedProjectData)}%`}</b>
    <span>{projectProgressNeedsPeriod(selectedProjectData)?"루틴 진행률 계산을 위해 프로젝트 시작일과 마감일을 설정해 주세요.":selectedProjectIntelligence?.progressSource==="execution"?`Todo ${selectedProjectIntelligence.completedTodos.length}/${selectedProjectIntelligence.connectedTodos.length} · 루틴 ${selectedProjectIntelligence.routineCompleted}/${selectedProjectIntelligence.routineScheduled}회`:selectedProjectIntelligence?.progressSource==="routines"?`루틴 ${selectedProjectIntelligence.routineCompleted} / ${selectedProjectIntelligence.routineScheduled}회 완료`:selectedProjectIntelligence?.progressSource==="todos"?`연결 Todo ${selectedProjectIntelligence.completedTodos.length} / ${selectedProjectIntelligence.connectedTodos.length} 완료`:selectedProjectIntelligence?.progressSource==="milestones"?`중간 목표 ${selectedProjectData.milestones.filter(m=>m.done).length} / ${selectedProjectData.milestones.length} 완료`:"측정 데이터 없음"}</span>
   </div>
   <button className="softBtn" onClick={()=>setProjectEditing(value=>!value)}>{projectEditing?"완료":"수정"}</button>
  </header>

  <div className="projectMainProgress"><i style={{width:`${projectProgressValue(selectedProjectData)}%`}}></i></div>

  <section className="projectIntelligence projectIntelligenceCompact" aria-label="Project Intelligence">
   <div className="projectIntelligenceHead"><div><span>PROJECT INTELLIGENCE</span><h3>운영 현황</h3></div><b className={`projectHealth ${selectedProjectIntelligence?.health??"healthy"}`}>{selectedProjectIntelligence?.health==="atRisk"?"위험":selectedProjectIntelligence?.health==="attention"?"주의":"정상"}</b></div>
   <div className="projectSignalRow">
    <div><span>다음 행동</span>{projectEditing?<input className="projectInlineNextAction" aria-label="다음 행동" value={selectedProjectData.next} placeholder="지금 바로 실행할 한 가지" onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,next:e.target.value}:p))}/>:<strong>{selectedProjectIntelligence?.nextAction?.title||"다음 행동 미설정"}</strong>}</div>
    <div><span>최근 활동</span><strong>{selectedProjectIntelligence?.lastActivityAt||"기록 없음"}</strong></div>
    <div><span>상태</span><strong>{selectedProjectIntelligence?.stalled?"정체 확인 필요":selectedProjectIntelligence?.overdueTodos.length?`마감 지난 할 일 ${selectedProjectIntelligence.overdueTodos.length}개`:"정상 운영"}</strong></div>
   </div>
   {selectedProjectIntelligence?.recentActivity.length?<div className="projectRecentActivity"><span>최근 기록</span><div>{selectedProjectIntelligence.recentActivity.slice(0,3).map(item=><article key={`${item.date}-${item.kind}-${item.title}`}><time>{item.date}</time><strong>{item.title}</strong><small>{item.kind==="activity"?"활동":item.kind==="note"?"노트":item.kind==="todo_completed"?"완료 Todo":"목표"}</small></article>)}</div></div>:null}
   {selectedProjectIntelligence?.risks.length?<p className="projectRisks">{selectedProjectIntelligence.risks.join(" · ")}</p>:null}
  </section>

  <details className="projectSection projectCompactPanel">
   <summary><div><h3>중간 목표</h3><small>{selectedProjectData.milestones.length}개</small></div><span>⌄</span></summary>
   <div className="projectCompactBody"><div className="projectCompactActions"><p>프로젝트를 완성하기 위한 큰 단계를 관리합니다.</p><button className="btnSecondary" onClick={()=>setProjectDialog("milestone")}>＋ 중간 목표</button></div>
   <div className="milestoneAccordion">
    {selectedProjectData.milestones.map((m,index)=><details key={m.id} className={m.done?"completed":""} draggable onDragStart={()=>setDraggingMilestoneId(m.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(draggingMilestoneId)reorderMilestone(draggingMilestoneId,m.id);setDraggingMilestoneId(null)}}>
     <summary>
      <span className="milestoneDragHandle" title="끌어서 순서 변경" onClick={e=>e.stopPropagation()}>⋮⋮</span>
      <input type="checkbox" checked={m.done} onClick={e=>e.stopPropagation()} onChange={()=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.map(x=>x.id===m.id?{...x,done:!x.done}:x)}:p))}/>
      <div><strong>{m.title||`중간 목표 ${index+1}`}</strong><small>{m.done?"완료됨":`진행률에 ${m.weight}% 반영`} · {(m.startDate??selectedProjectData.startDate)?.replaceAll("-",".")||"시작 미정"} ~ {(m.dueDate??selectedProjectData.dueDate)?.replaceAll("-",".")||"마감 미정"}{!m.startDate&&!m.dueDate&&(selectedProjectData.startDate||selectedProjectData.dueDate)?" · 프로젝트 기간 상속":""}</small></div>
      <span className="accordionChevron">⌄</span>
     </summary>
     <div className="milestoneBody">
      <label className="milestoneNameField"><span>중간 목표 이름</span><input value={m.title} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.map(x=>x.id===m.id?{...x,title:e.target.value}:x)}:p))}/></label>
      <label className="milestoneWeightField"><span>진행률 반영 비중</span><div className="weightInput"><input type="number" min="0" max="100" value={m.weight} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.map(x=>x.id===m.id?{...x,weight:Number(e.target.value)}:x)}:p))}/><b>%</b></div></label>
      <label className="milestoneStartField"><span>시작일 <small>{!m.startDate&&selectedProjectData.startDate?"프로젝트 날짜 사용":""}</small></span><input type="date" value={m.startDate??selectedProjectData.startDate??""} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.map(x=>x.id===m.id?{...x,startDate:e.target.value&&e.target.value!==selectedProjectData.startDate?e.target.value:undefined}:x)}:p))}/></label>
      <label className="milestoneDueField"><span>마감일 <small>{!m.dueDate&&selectedProjectData.dueDate?"프로젝트 날짜 사용":""}</small></span><input type="date" min={m.startDate??selectedProjectData.startDate??undefined} value={m.dueDate??selectedProjectData.dueDate??""} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.map(x=>x.id===m.id?{...x,dueDate:e.target.value&&e.target.value!==selectedProjectData.dueDate?e.target.value:undefined}:x)}:p))}/></label>
      <div className="milestoneLinkedRoutines"><span>연결 루틴</span><div>{local.recurringTasks.filter(task=>task.projectId===selectedProjectData.id).map(task=><label key={task.id} className={task.milestoneId===m.id?"linked":""}><input type="checkbox" checked={task.milestoneId===m.id} onChange={e=>update("recurringTasks",local.recurringTasks.map(item=>item.id===task.id?{...item,milestoneId:e.target.checked?m.id:(item.milestoneId===m.id?undefined:item.milestoneId),updatedAt:new Date().toISOString()}:item))}/><span>{task.title}</span><small>{describeRecurrence(task)}</small></label>)}{!local.recurringTasks.some(task=>task.projectId===selectedProjectData.id)&&<small className="milestoneNoRoutine">프로젝트 루틴이 없습니다.</small>}</div></div>
      <button className="btnDangerOutline milestoneDeleteBtn" onClick={()=>{update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.filter(x=>x.id!==m.id)}:p));update("recurringTasks",local.recurringTasks.map(task=>task.projectId===selectedProjectData.id&&task.milestoneId===m.id?{...task,milestoneId:undefined,updatedAt:new Date().toISOString()}:task))}}>중간 목표 삭제</button>
     </div>
    </details>)}
    {!selectedProjectData.milestones.length&&<div className="emptyMilestones"><strong>아직 중간 목표가 없습니다.</strong><span>프로젝트를 완성하기 위한 큰 단계를 추가해보세요.</span></div>}
   </div>

   </div>
  </details>

  <details className="projectSection linkedProjectSection projectCompactPanel">
   <summary><div><h3>연결된 항목</h3><small>{local.tasks.filter(t=>t.projectId===selectedProjectData.id).length+local.recurringTasks.filter(t=>t.projectId===selectedProjectData.id).length+local.activities.filter(a=>a.projectId===selectedProjectData.id).length+local.notes.filter(n=>n.projectId===selectedProjectData.id).length}개</small></div><span>⌄</span></summary>
   <div className="projectCompactBody">
   <div className="linkedAccordions">
    <details><summary><span>할 일</span><b>{local.tasks.filter(t=>t.projectId===selectedProjectData.id).length}</b><i>⌄</i></summary><div>{local.tasks.filter(t=>t.projectId===selectedProjectData.id).map(t=><article key={t.id}><input type="checkbox" checked={t.done} onChange={()=>update("tasks",local.tasks.map(item=>item.id===t.id?{...item,done:!item.done,doneAt:item.done?undefined:todayKey()}:item))}/><span>{t.title}</span><div className="linkedRoutineActions"><button type="button" onClick={()=>setEditingTask({...t})}>수정</button><button type="button" onClick={()=>void removeTask(t)}>삭제</button></div></article>)}{!local.tasks.some(t=>t.projectId===selectedProjectData.id)&&<p>연결된 할 일이 없습니다.</p>}</div></details>
    <details className="projectRoutineAccordion"><summary><span>루틴</span><b>{local.recurringTasks.filter(t=>t.projectId===selectedProjectData.id).length}</b><i>⌄</i></summary><div>
      <form className="projectRoutineComposer projectRoutineComposerWithMilestone" onSubmit={e=>{e.preventDefault();addProjectRoutine()}}>
       <input value={projectRoutineTitle} onChange={e=>setProjectRoutineTitle(e.target.value)} placeholder="프로젝트 루틴 추가"/>
       <select value={projectRoutineMilestone} onChange={e=>setProjectRoutineMilestone(e.target.value)} aria-label="중간 목표 연결"><option value="">프로젝트 전체</option>{selectedProjectData.milestones.map(milestone=><option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</select>
       <select value={projectRoutineMode} onChange={e=>setProjectRoutineMode(e.target.value as typeof projectRoutineMode)}><option value="DAILY">매일</option><option value="WEEKDAYS">평일</option><option value="WEEKENDS">주말</option><option value="WEEKLY">매주 요일</option><option value="WEEKLY_BLOCKS">주간 구간</option><option value="BIWEEKLY">격주</option></select>
       <button type="submit">추가</button>
      </form>
      <p className="projectRoutinePeriodNote">프로젝트 시작일~마감일을 연결 루틴의 실행 기간으로 사용합니다. 기간을 설정하면 예정 회차 대비 실제 완료 회차가 프로젝트 진행률에 반영됩니다.</p>
      {local.recurringTasks.filter(t=>t.projectId===selectedProjectData.id).map(t=><article key={`recurring-${t.id}`} className={!t.isActive?"paused":""}><span><strong>{t.title}</strong><small>{t.milestoneId?`중간목표 · ${selectedProjectData.milestones.find(milestone=>milestone.id===t.milestoneId)?.title||"연결 정보 없음"} · `:"프로젝트 전체 · "}{describeRecurrence(t)} · 프로젝트 기간 {selectedProjectData.startDate?.replaceAll("-",".")||"시작 미정"} ~ {selectedProjectData.dueDate?.replaceAll("-",".")||"마감 미정"}{!t.isActive?" · 중지됨":""}</small></span><div className="linkedRoutineActions projectRoutineActions"><select value={t.milestoneId??""} onChange={e=>update("recurringTasks",local.recurringTasks.map(item=>item.id===t.id?{...item,milestoneId:e.target.value||undefined,updatedAt:new Date().toISOString()}:item))} aria-label={`${t.title} 중간목표 연결`}><option value="">프로젝트 전체</option>{selectedProjectData.milestones.map(milestone=><option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</select><button type="button" onClick={()=>{editRecurringInline(t);navigateTo("routines")}}>수정</button><button type="button" onClick={()=>void setRecurringActive(t,!t.isActive)}>{t.isActive?"중지":"시작"}</button><button type="button" onClick={()=>void removeRecurringTask(t)}>삭제</button></div></article>)}
      {!local.recurringTasks.some(t=>t.projectId===selectedProjectData.id)&&<p>연결된 루틴이 없습니다.</p>}
    </div></details>
    <details><summary><span>활동</span><b>{local.activities.filter(a=>a.projectId===selectedProjectData.id).length}</b><i>⌄</i></summary><div><div className="linkedEntityAddRow"><span>실제로 한 활동을 이 프로젝트 기록에 연결합니다.</span><button type="button" onClick={()=>{setActivityProject(selectedProjectData.id);setActivityDate(currentDateKey);navigateTo("activities")}}>＋ 활동 추가</button></div>{local.activities.filter(a=>a.projectId===selectedProjectData.id).sort((a,b)=>b.date.localeCompare(a.date)).map(a=><article key={a.id}><span>{a.date}</span><strong>{a.title}</strong><div className="linkedRoutineActions"><button type="button" onClick={()=>setEditingActivity({...a})}>수정</button><button type="button" onClick={()=>update("activities",local.activities.filter(item=>item.id!==a.id))}>삭제</button></div></article>)}{!local.activities.some(a=>a.projectId===selectedProjectData.id)&&<p>연결된 활동이 없습니다.</p>}</div></details>
    <details><summary><span>노트</span><b>{local.notes.filter(n=>n.projectId===selectedProjectData.id).length}</b><i>⌄</i></summary><div><div className="linkedEntityAddRow"><span>생각·배움·참고사항을 프로젝트 맥락에 남깁니다.</span><button type="button" onClick={()=>{setNoteProject(selectedProjectData.id);navigateTo("notes")}}>＋ 노트 추가</button></div>{local.notes.filter(n=>n.projectId===selectedProjectData.id).sort((a,b)=>b.date.localeCompare(a.date)).map(n=><article key={n.id}><span>{n.date}</span><strong>{n.title}</strong><div className="linkedRoutineActions"><button type="button" onClick={()=>setEditingNote({...n})}>수정</button><button type="button" onClick={()=>update("notes",local.notes.filter(item=>item.id!==n.id))}>삭제</button></div></article>)}{!local.notes.some(n=>n.projectId===selectedProjectData.id)&&<p>연결된 노트가 없습니다.</p>}</div></details>
   </div>

   </div>
  </details>

  <section className="projectVisibleMeta projectMemoOnly" aria-label="프로젝트 메모">
   <label className="projectMemoField"><span>프로젝트 메모</span><textarea placeholder="참고할 내용과 맥락을 기록합니다." value={selectedProjectData.note} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,note:e.target.value}:p))}/></label>
  </section>

  <div className="projectFooterActions"><button className="btnDangerOutline" onClick={()=>{if(confirm("이 프로젝트를 삭제할까요?")){update("projects",local.projects.filter(p=>p.id!==selectedProjectData.id));setSelectedProject(local.projects.find(p=>p.id!==selectedProjectData.id)?.id??"")}}}>프로젝트 삭제</button></div>
   </section>}
</div>}


{view==="people"&&<div className="peopleWorkspace">
 <section className="premiumCard peopleHeader">
  <div><span>관계</span><h2>사람과 다음 연락을 관리합니다.</h2><p>연락처를 가져온 뒤 필요한 사람만 후속 일정과 메모를 붙여 관리하세요.</p></div>
  <div className="contactImportActions">
   <button onClick={importGoogleContacts} disabled={contactsImporting}>{contactsImporting?"불러오는 중…":"Google 연락처"}</button>
   <button onClick={pickDeviceContacts}>휴대폰 연락처 선택</button>
   <label className="contactFileButton">VCF 파일<input type="file" accept=".vcf,text/vcard" onChange={e=>{const f=e.target.files?.[0];if(f)importVCard(f);e.currentTarget.value=""}}/></label>
  </div>
 </section>
 <section className="premiumCard peopleToolbar">
  <input value={peopleSearch} onChange={e=>setPeopleSearch(e.target.value)} placeholder="이름·전화번호·이메일·태그 검색"/>
  <div>{([["all","전체"],["due","연락 예정"],["waiting","답변 대기"],["stale","30일 이상 미연락"]] as const).map(([v,l])=><button className={peopleFilter===v?"active":""} onClick={()=>setPeopleFilter(v)} key={v}>{l}</button>)}</div>
  <strong>{filteredPeople.length}명</strong>
 </section>
 <section className="premiumCard peopleComposer">
  <input value={personName} onChange={e=>setPersonName(e.target.value)} placeholder="이름"/>
  <input value={personTag} onChange={e=>setPersonTag(e.target.value)} placeholder="태그"/>
  <button className="goldBtn" onClick={addPerson}>직접 추가</button>
 </section>
 <section className="peopleGrid">{filteredPeople.map(p=><article className="premiumCard personCard" key={p.id}>
  <div className="personHead"><div className="avatar">{p.name.slice(0,1)}</div><div><h3>{p.name}</h3><span>{[p.organization,...p.tags].filter(Boolean).join(" · ")}</span></div>{p.waiting&&<b className="waitingBadge">답변 대기</b>}</div>
  {(p.phone||p.email)&&<div className="personContactLines">{p.phone&&<a href={`tel:${p.phone}`}>{p.phone}</a>}{p.email&&<a href={`mailto:${p.email}`}>{p.email}</a>}</div>}
  <div className="personQuickActions">{p.phone&&<><a href={`tel:${p.phone}`}>전화</a><a href={`sms:${p.phone}`}>문자</a></>}{p.email&&<a href={`mailto:${p.email}`}>메일</a>}<button onClick={()=>update("people",local.people.map(x=>x.id===p.id?{...x,waiting:!x.waiting}:x))}>{p.waiting?"대기 해제":"답변 대기"}</button></div>
  <label>최근 연락<input type="date" value={p.lastContact} onChange={e=>update("people",local.people.map(x=>x.id===p.id?{...x,lastContact:e.target.value}:x))}/></label>
  <label>다음 연락<input type="date" value={p.nextContact} onChange={e=>update("people",local.people.map(x=>x.id===p.id?{...x,nextContact:e.target.value}:x))}/></label>
  <label>메모<textarea value={p.note} onChange={e=>update("people",local.people.map(x=>x.id===p.id?{...x,note:e.target.value}:x))}/></label>
  <div className="cardActions"><button onClick={()=>setEditingPerson({...p,logs:p.logs??[]})}>상세·기록</button><button onClick={()=>update("people",local.people.filter(x=>x.id!==p.id))}>삭제</button></div>
 </article>)}
 {!filteredPeople.length&&<div className="peopleEmpty"><strong>표시할 사람이 없습니다.</strong><span>연락처를 가져오거나 직접 추가해 보세요.</span></div>}
 </section>
</div>}


{view==="records"&&<div className="recordsWorkspace">
   <section className="premiumCard recordsHero">
    <div><span>기록</span><h2>실행·활동·노트·리뷰를 한 흐름으로 봅니다.</h2><p>완료한 일, 실행한 활동, 떠오른 생각, 하루의 회고가 날짜 순서로 이어집니다.</p></div>
    <div className="recordQuickActions"><button onClick={()=>navigateTo("activities")}>활동 기록</button><button onClick={()=>navigateTo("notes")}>노트 작성</button><button onClick={()=>{setReviewDate(currentDateKey);navigateTo("review")}}>리뷰 작성</button></div>
   </section>
   <section className="recordSummaryGrid">
    <article className={`premiumCard ${recordFilter==="activity"?"activeRecordSummary":""}`}><div><strong>{local.activities.length}</strong><span>활동 기록</span></div><button aria-pressed={recordFilter==="activity"} onClick={()=>setRecordFilter(recordFilter==="activity"?"all":"activity")}>보기</button></article>
    <article className={`premiumCard ${recordFilter==="note"?"activeRecordSummary":""}`}><div><strong>{local.notes.length}</strong><span>노트</span></div><button aria-pressed={recordFilter==="note"} onClick={()=>setRecordFilter(recordFilter==="note"?"all":"note")}>보기</button></article>
    <article className={`premiumCard ${recordFilter==="review"?"activeRecordSummary":""}`}><div><strong>{eveningReviews.length}</strong><span>리뷰</span></div><button aria-pressed={recordFilter==="review"} onClick={()=>setRecordFilter(recordFilter==="review"?"all":"review")}>보기</button></article>
   </section>
   <section className="premiumCard recordsTimelineCard" id="recent-records">
    <div className="cardTitle"><div><h2>최근 기록 · {recordFilterLabel}</h2><small>기록 종류를 누르면 이 자리에서 바로 골라 봅니다.</small></div>{recordFilter!=="all"?<button onClick={()=>setRecordFilter("all")}>전체 기록</button>:<button onClick={()=>navigateTo("timeline")}>전체 타임라인</button>}</div>
    <div className="timeline groupedRecordTimeline">
     {filteredTimelineGroups.map(year=><details className="recordYearGroup" key={year.year}><summary><strong>{year.year}년</strong><span>{year.months.reduce((sum,month)=>sum+month.entries.length,0)}개</span></summary><div>{year.months.map(month=><details className="recordMonthGroup" key={month.month}><summary><strong>{Number(month.month.slice(5,7))}월</strong><span>{month.entries.length}개</span></summary><div>{month.entries.map((item,index)=><article key={`${item.date}-${item.kind}-${index}`}><time>{item.date}</time><div><span>{item.kind}{item.project&&<em className="recordProjectTag">{item.project}</em>}</span><strong>{item.title}</strong>{item.note&&<p>{item.note}</p>}</div></article>)}</div></details>)}</div></details>)}
     {!filteredTimeline.length&&(recordFilter==="activity"?<div className="recordEmptyAction"><strong>저장된 활동 기록이 없습니다.</strong><span>활동 기록에서 저장하면 이곳과 프로젝트 기록에 바로 연결됩니다.</span><button type="button" onClick={()=>navigateTo("activities")}>활동 기록 추가</button></div>:<p className="empty">이 범주의 기록이 없습니다.</p>)}
    </div>
   </section>
  </div>}

  {view==="activities"&&<><section className="subpageHeader premiumCard"><button className="backToRecords" onClick={goBackFromDetail}>← 뒤로</button><div><span>활동 기록</span><h2>실행한 것을 남깁니다.</h2></div></section><section className="premiumCard activityComposer">
<label className="activityTypeField"><span>활동 종류</span><select value={activityType} onChange={e=>setActivityType(e.target.value as ActivityType)}>{Object.entries(activityLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
<label className="activityDateField"><span>날짜</span><input type="date" value={activityDate} onChange={e=>setActivityDate(e.target.value)}/></label>
<label className="activityTitleField">
 <span>{activityTitleLabel[activityType]}</span>
 <input value={activityTitle} onChange={e=>setActivityTitle(e.target.value)} placeholder={activityPlaceholder[activityType]}/>
</label>
<label className="activityDurationField"><span>활동 시간</span><div className="unitInput"><input type="number" min="0" value={activityDuration} onChange={e=>setActivityDuration(Number(e.target.value))}/><b>분</b></div></label>
<label className="activityAmountField"><span>{activityType==="running"?"거리":activityType==="reading"?"읽은 분량":activityType==="workout"?"운동량":"수치(선택)"}</span><div className="unitInput"><input type="number" min="0" step="0.1" value={activityAmount} onChange={e=>setActivityAmount(Number(e.target.value))}/><b>{activityType==="running"?"km":activityType==="reading"?"쪽":activityType==="workout"?"세트":activityType==="study"?"회":""}</b></div></label>
<label className="activityProjectField"><span>연결 프로젝트</span><select value={activityProject} onChange={e=>setActivityProject(e.target.value)}><option value="">없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
<label className="wideField activityReflectionField"><span>기록과 느낌</span><textarea value={activityNote} onChange={e=>setActivityNote(e.target.value)} placeholder="몸 상태, 내용, 느낀 점"/></label>
<label className="wideField activityLearnField"><span>배운 것</span><textarea value={activityLearned} onChange={e=>setActivityLearned(e.target.value)} placeholder="새롭게 알게 된 것"/></label>
<label className="wideField activityApplyField"><span>적용할 것</span><textarea value={activityApplied} onChange={e=>setActivityApplied(e.target.value)} placeholder="다음에 실제로 적용할 것"/></label>
<button className="goldBtn activitySaveBtn" onClick={addActivity}>기록 저장</button>
</section><section className="activityCards">{[...local.activities].sort((a,b)=>b.date.localeCompare(a.date)).map(a=><article className="premiumCard" key={a.id}><div className="activityHead"><span>{activityLabels[a.type]}</span><time>{a.date}</time></div>{a.projectId&&<span className="recordProjectTag standaloneProjectTag">{projectNameById(a.projectId)}</span>}<h3>{a.title}</h3><p><b>{a.duration}분</b>{a.amount?` · ${a.amount}${a.unit==="page"?"쪽":a.unit}`:""}</p>{a.note&&<small>{a.note}</small>}{a.learned&&<small>배운 것 · {a.learned}</small>}{a.applied&&<small>적용 · {a.applied}</small>}<div className="cardActions"><button onClick={()=>setEditingActivity({...a})}>수정</button><button onClick={()=>update("activities",local.activities.filter(x=>x.id!==a.id))}>삭제</button></div></article>)}{!local.activities.length&&<article className="premiumCard activityEmptyState"><strong>아직 저장된 활동이 없습니다.</strong><span>위에서 활동을 저장하면 날짜순으로 여기에 쌓입니다.</span></article>}</section></>}

  {view==="notes"&&<><section className="subpageHeader premiumCard"><button className="backToRecords" onClick={goBackFromDetail}>← 뒤로</button><div><span>노트</span><h2>생각과 정보를 기록합니다.</h2></div></section><section className="premiumCard noteComposer"><select value={noteType} onChange={e=>setNoteType(e.target.value as NoteType)}>{Object.entries(noteLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><input value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} placeholder="제목"/><textarea value={noteBody} onChange={e=>setNoteBody(e.target.value)} placeholder="기록할 내용을 적으세요"/><select value={noteProject} onChange={e=>setNoteProject(e.target.value)}><option value="">프로젝트 없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="goldBtn" onClick={addNote}>저장</button></section><section className="noteGrid">{[...local.notes].sort((a,b)=>b.date.localeCompare(a.date)).map(n=><article className="premiumCard" key={n.id}><span>{noteLabels[n.type]} · {n.date}</span>{n.projectId&&<span className="recordProjectTag standaloneProjectTag">{projectNameById(n.projectId)}</span>}<h3>{n.title}</h3><p>{n.body}</p><div className="cardActions"><button onClick={()=>setEditingNote({...n})}>수정</button><button onClick={()=>update("notes",local.notes.filter(x=>x.id!==n.id))}>삭제</button></div></article>)}</section></>}

  {view==="review"&&<><section className="subpageHeader premiumCard"><button className="backToRecords" onClick={goBackFromDetail}>← 뒤로</button><div><span>하루 리뷰</span><h2>하루를 돌아보고 다음을 정합니다.</h2></div></section><div className="reviewWorkspace"><aside className="premiumCard reviewHistory"><input type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/>{reviewDates.map(d=><button className={d===reviewDate?"active":""} onClick={()=>setReviewDate(d)} key={d}>{new Date(`${d}T00:00`).toLocaleDateString("ko-KR",{month:"short",day:"numeric",weekday:"short"})}</button>)}</aside><section className="premiumCard reviewForm"><div className="briefBubble"><strong>오늘의 계획과 실제</strong><p>할 일 {getDailyRecord({date:reviewDate,goal:currentReview.goal,reason:"",enjoyment:currentReview.enjoyment,gratitude:currentReview.morningGratitude,tasks:contextTasks,events:operationalContextEvents.filter(event=>eventOccursOnDate(event,reviewDate)).map(event=>({id:event.id,title:event.title,start:event.start,end:event.end,context:event.calendarName})),projects:local.projects,reviews:local.reviews}).todoSummary.completed} / {getDailyRecord({date:reviewDate,goal:currentReview.goal,reason:"",enjoyment:currentReview.enjoyment,gratitude:currentReview.morningGratitude,tasks:contextTasks,events:operationalContextEvents.filter(event=>eventOccursOnDate(event,reviewDate)).map(event=>({id:event.id,title:event.title,start:event.start,end:event.end,context:event.calendarName})),projects:local.projects,reviews:local.reviews}).todoSummary.total} 완료 · 일정 {operationalContextEvents.filter(event=>eventOccursOnDate(event,reviewDate)).length}개</p></div><div className="reviewSummary reviewSummaryPrimary"><label>그날 목표<input value={currentReview.goal} onChange={e=>updateReview({goal:e.target.value})}/></label><label>그날 즐길 것<input value={currentReview.enjoyment} onChange={e=>updateReview({enjoyment:e.target.value})}/></label><label className="reviewStatusField">목표 결과<select value={currentReview.status} onChange={e=>updateReview({status:e.target.value as Review["status"]})}><option value="">선택</option><option value="done">완료</option><option value="not_done">미완료</option><option value="changed">우선순위 변경</option></select></label></div><div className="reviewGrid"><label>잘한 점<textarea value={currentReview.good} onChange={e=>updateReview({good:e.target.value})}/></label><label>배운 점<textarea value={currentReview.learned} onChange={e=>updateReview({learned:e.target.value})}/></label><label>즐거웠던 순간<textarea value={currentReview.joy} onChange={e=>updateReview({joy:e.target.value})}/></label><ReviewGratitude morningValues={currentReview.morningGratitude} eveningValues={currentReview.eveningGratitude} onMorningChange={(index,value)=>{const values=[...currentReview.morningGratitude];values[index]=value;updateReview({morningGratitude:values,gratitude:values.filter(Boolean).join(" / ")})}} onEveningChange={(index,value)=>{const values=[...currentReview.eveningGratitude];values[index]=value;updateReview({eveningGratitude:values})}}/></div><button className="goldBtn reviewSaveBtn" type="button" onClick={saveEveningReview}>저녁 리뷰 저장</button></section></div></>}
  {view==="timeline"&&<><section className="subpageHeader premiumCard"><button className="backToRecords" onClick={goBackFromDetail}>← 뒤로</button><div><span>전체 타임라인</span><h2>연도와 월을 열고 닫아 기록을 봅니다.</h2></div></section><section className="premiumCard timelineList groupedTimelineList">{timelineGroups.map(year=><details className="timelineYearGroup" key={year.year}><summary><strong>{year.year}년</strong><span>{year.months.reduce((sum,month)=>sum+month.entries.length,0)}개 기록</span></summary><div>{year.months.map(month=><details className="timelineMonthGroup" key={month.month}><summary><strong>{Number(month.month.slice(5,7))}월</strong><span>{month.entries.length}개</span></summary><div>{month.entries.map((x,i)=><article key={`${x.date}-${x.kind}-${i}`}><time>{x.date}</time><i/><div><span>{x.kind}{x.project&&<em className="recordProjectTag">{x.project}</em>}</span><h3>{x.title}</h3>{x.note&&<p>{x.note}</p>}</div></article>)}</div></details>)}</div></details>)}</section></>}

  {view==="analytics"&&<>
<section className="premiumCard dashboardSection lifeFlowPanel">
 <div className="cardTitle"><div><h2>이번 주 흐름</h2><small>{weeklyIntelligence.start} ~ {weeklyIntelligence.end} · 실제 실행 데이터</small></div><button onClick={()=>{prepareAi("weekly");navigateTo("ai")}}>ChatGPT에 해석 요청</button></div>
 <div className="lifeFlowMetrics">
  <article><span>Todo</span><strong>{weeklyIntelligence.todo.completed}/{weeklyIntelligence.todo.total}</strong><small>{weeklyIntelligence.todo.total?Math.round(weeklyIntelligence.todo.completed/weeklyIntelligence.todo.total*100):0}% 완료</small></article>
  <article><span>Routine</span><strong>{weeklyIntelligence.routine.completed}/{weeklyIntelligence.routine.scheduled}</strong><small>{weeklyIntelligence.routine.completionRate}% 수행</small></article>
  <article><span>Calendar</span><strong>{weeklyIntelligence.calendar.count}건</strong><small>{Math.round(weeklyIntelligence.calendar.minutes/60)}시간</small></article>
  <article><span>기록</span><strong>{weeklyIntelligence.records.evening}일</strong><small>Morning {weeklyIntelligence.records.morning}일</small></article>
 </div>
 <div className="lifeFlowSignals">
  <span>Carry <b>{weeklyIntelligence.todo.carry}</b></span>
  <span>Overdue <b>{weeklyIntelligence.todo.overdue}</b></span>
  <span>프로젝트 활동 <b>{weeklyIntelligence.projects.length}</b></span>
  <span>반복 이월 <b>{weeklyIntelligence.deferred.length}</b></span>
 </div>
</section>
<section className="premiumCard dashboardSection lifeFlowPanel">
 <div className="cardTitle"><div><h2>이번 달 흐름</h2><small>{monthlyIntelligence.range.start} ~ {monthlyIntelligence.range.end} · 한 달의 시간과 실행 흐름</small></div></div>
 <div className="lifeFlowMetrics">
  <article><span>Todo</span><strong>{monthlyIntelligence.todo.completed.length}/{monthlyIntelligence.todo.planned.length}</strong><small>{monthlyIntelligence.todo.completionRate}% 완료</small></article>
  <article><span>Routine</span><strong>{monthlyIntelligence.routine.completed}/{monthlyIntelligence.routine.scheduled}</strong><small>{monthlyIntelligence.routine.completionRate}% 수행</small></article>
  <article><span>Calendar</span><strong>{monthlyIntelligence.calendar.count}건</strong><small>{Math.round(monthlyIntelligence.calendar.minutes/60)}시간</small></article>
  <article><span>기록</span><strong>{monthlyIntelligence.records.eveningReviews}일</strong><small>Morning {monthlyIntelligence.records.morningDirections}일</small></article>
 </div>
 <div className="lifeFlowSignals">
  <span>Carry <b>{monthlyIntelligence.todo.carryCount}</b></span>
  <span>Overdue <b>{monthlyIntelligence.todo.overdue.length}</b></span>
  <span>움직인 프로젝트 <b>{monthlyIntelligence.projects.length}</b></span>
  <span>정체 프로젝트 <b>{monthlyIntelligence.stalledProjects.length}</b></span>
 </div>
 {monthlyIntelligence.weeklyFlow.length>0&&<div className="monthlyFlowStrip">{monthlyIntelligence.weeklyFlow.map((week,index)=><article key={week.start}><span>{index+1}주</span><strong>{week.completionRate}%</strong><small>Todo {week.todoCompleted}/{week.todoTotal} · 일정 {week.calendarCount}</small></article>)}</div>}
</section>
<section className="premiumCard dashboardSection personalIntelligencePanel" aria-label="Life Facts">
 <div className="cardTitle"><div><h2>Life Facts · 최근 30일</h2><small>{personalIntelligence.period.start} ~ {personalIntelligence.period.end} · 직전 30일과의 차이만 표시합니다.</small></div><button onClick={()=>{prepareAi("weekly");navigateTo("ai")}}>ChatGPT에 물어보기</button></div>
 <div className="intelligenceMetricGrid">
  <article><span>Todo 완료율</span><strong>{personalIntelligence.todo.completionRate}%</strong><small>직전 대비 {personalIntelligence.comparison.todoRateDelta>=0?"+":""}{personalIntelligence.comparison.todoRateDelta}%p</small></article>
  <article><span>Routine 수행률</span><strong>{personalIntelligence.routine.completionRate}%</strong><small>{personalIntelligence.routine.completed}/{personalIntelligence.routine.scheduled}회</small></article>
  <article><span>Calendar 시간</span><strong>{Math.round(personalIntelligence.calendar.minutes/60)}시간</strong><small>직전 대비 {personalIntelligence.comparison.calendarMinutesDelta>=0?"+":""}{Math.round(personalIntelligence.comparison.calendarMinutesDelta/60)}시간</small></article>
  <article><span>Review</span><strong>{personalIntelligence.records.eveningReviews}일</strong><small>Morning {personalIntelligence.records.morningDirections}일</small></article>
 </div>
 <div className="intelligenceObservations"><h3>30일 변화</h3>
  <article><div><strong>이월</strong><p>{personalIntelligence.todo.carryCount}회 · 반복 이월 Todo {personalIntelligence.todo.repeatedCarry.length}개</p></div><span>{personalIntelligence.comparison.carryDelta>=0?"+":""}{personalIntelligence.comparison.carryDelta}회</span></article>
  <article><div><strong>기한 경과</strong><p>미완료 overdue Todo {personalIntelligence.todo.overdue}개</p></div><span>{personalIntelligence.comparison.overdueDelta>=0?"+":""}{personalIntelligence.comparison.overdueDelta}개</span></article>
  <article><div><strong>Morning 기록</strong><p>최근 30일 {personalIntelligence.records.morningDirections}일</p></div><span>{personalIntelligence.comparison.morningDelta>=0?"+":""}{personalIntelligence.comparison.morningDelta}일</span></article>
  <article><div><strong>Evening Review</strong><p>최근 30일 {personalIntelligence.records.eveningReviews}일</p></div><span>{personalIntelligence.comparison.reviewDelta>=0?"+":""}{personalIntelligence.comparison.reviewDelta}일</span></article>
 </div>
</section></>}

  {view==="chapters"&&<><div className="detailBackRow"><button className="backToRecords" onClick={goBackFromDetail}>← 뒤로</button></div><section className="premiumCard chapterComposer"><label><span>새 시기 이름</span><input value={chapterTitle} onChange={e=>setChapterTitle(e.target.value)} placeholder="예: JEONG를 완성하는 시기"/></label><label><span>이 시기의 의미</span><input value={chapterDescription} onChange={e=>setChapterDescription(e.target.value)} placeholder="무엇을 만들고 살아갈 시기인가"/></label><button className="goldBtn" onClick={addChapter}>새 시기 시작</button></section><section className="chapterGrid">{[...local.chapters].reverse().map(c=><article className={`premiumCard ${c.active?"active":""}`} key={c.id}><div className="chapterContent"><span>{c.active?"현재 시기":"지난 시기"}</span><h3>{c.title}</h3><p>{c.description}</p><small>{c.startDate}{c.endDate?` — ${c.endDate}`:" — 진행 중"}</small></div>{c.active&&<button className="chapterEndBtn" onClick={()=>update("chapters",local.chapters.map(x=>x.id===c.id?{...x,active:false,endDate:todayKey()}:x))}>현재 시기 종료</button>}</article>)}</section></>}


  {view==="ai"&&<section className="premiumCard aiBridgePanel aiBridgeSimple">
   <div className="cardTitle"><div><h2>ChatGPT 연결</h2><small>JEONG의 현재 Life State를 선택한 목적에 맞춰 복사하고 ChatGPT를 엽니다.</small></div></div>
   <div className="aiTypeGrid">
    <button className={aiType==="morning"?"active":""} onClick={()=>prepareAi("morning")}><strong>아침 브리핑</strong><span>오늘 일정·할 일·Routine·Project</span></button>
    <button className={aiType==="daily"?"active":""} onClick={()=>prepareAi("daily")}><strong>오늘 점검</strong><span>완료·남은 일·다음 행동</span></button>
    <button className={aiType==="weekly"?"active":""} onClick={()=>prepareAi("weekly")}><strong>주간 점검</strong><span>이번 주 실행과 흐름</span></button>
    <button className={aiType==="project"?"active":""} onClick={()=>prepareAi("project")}><strong>프로젝트 상담</strong><span>중간목표·루틴·다음 행동</span></button>
    <button className={aiType==="free"?"active":""} onClick={()=>prepareAi("free")}><strong>자유 대화</strong><span>JEONG 자료를 대화 배경으로</span></button>
   </div>
   <label className="aiPrivacyCheck"><input type="checkbox" checked={aiIncludePeople} onChange={e=>setAiIncludePeople(e.target.checked)}/><span>연락 예정인 사람의 이름·태그도 포함</span></label>
   <button className="goldBtn aiPrimaryButton aiDirectStartButton" onClick={openChatGPT}>현재 Life State로 ChatGPT 시작</button>
   <p className="aiHint">현재 데이터를 그 순간 새로 생성해 클립보드에 복사한 뒤 ChatGPT를 엽니다. 입력창에 붙여넣기(Ctrl+V)만 하면 됩니다.</p>
  </section>}

  {view==="profile"&&<><div className="detailBackRow"><button className="backToRecords" onClick={goBackFromDetail}>← 뒤로</button></div><section className="premiumCard profilePage" aria-label="개인정보"><header className="profilePageHeader"><div className="profilePageAvatar" aria-hidden="true">{user?.image?<img src={user.image} alt=""/>:<span>整</span>}</div><div><span>PERSONAL INFORMATION</span><h2>개인정보</h2><p>JEONG에서 사용하는 내 계정과 표시 정보를 확인합니다.</p></div></header><div className="profileInfoGrid"><article><span>JEONG 호칭</span><strong>황제</strong><small>앱 안에서 사용하는 표시 호칭입니다.</small></article><article><span>Google 계정 이름</span><strong>{user?.name||"이름 정보 없음"}</strong><small>Google 로그인 세션에서 읽은 정보입니다.</small></article><article><span>Google 이메일</span><strong>{user?.email||"이메일 정보 없음"}</strong><small>로그인 계정 확인용으로만 표시합니다.</small></article><article><span>데이터 보관</span><strong>JEONG 로컬 데이터 + Google Calendar</strong><small>설정에서 로컬 데이터 백업과 Google 데이터 새로고침을 관리할 수 있습니다.</small></article></div><div className="profilePageActions"><button className="softBtn" onClick={()=>navigateTo("settings")}>설정 열기</button></div></section></>}

  {view==="settings"&&<><section className="premiumCard advancedAccessPanel"><div className="cardTitle"><div><h2>고급 기능</h2><small>기본 메뉴에서는 숨기고, 필요한 사용자만 엽니다.</small></div></div><div className="advancedAccessButtons"><button onClick={()=>navigateTo("timeline")}>전체 타임라인</button><button onClick={()=>navigateTo("chapters")}>삶의 시기</button></div></section><section className="premiumCard settingsPanel"><h2>설정</h2><div><span>테마</span><button onClick={toggleTheme}>{theme==="light"?"다크 모드":"라이트 모드"}</button></div><div><span>Google 데이터</span><button onClick={refreshCalendarData}>{loading?"불러오는 중":"새로고침"}</button></div><div><span>백업 복원</span><label className="importBtn">파일 선택<input type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)importBackup(f)}}/></label></div><div><span>로컬 데이터 백업</span><button onClick={()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(local,null,2)],{type:"application/json"}));a.download=`JEONG-${todayKey()}.json`;a.click()}}>내보내기</button></div></section>
</>}
  </main>

  {calendarDayPreview&&<div className="overlay calendarDayPreviewOverlay" onMouseDown={e=>{if(e.target===e.currentTarget)setCalendarDayPreview(null)}}><section className="calendarDayPreviewModal" role="dialog" aria-modal="true" aria-label={`${calendarDayPreviewKey} 전체 스케줄`}>
   <div className="modalHead"><div><span>선택한 날짜</span><h2>{calendarDayPreview.toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"long"})}</h2><p>이 날의 스케줄 {calendarDayPreviewEvents.length}개</p></div><button type="button" className="softBtn" onClick={()=>setCalendarDayPreview(null)}>닫기</button></div>
   <div className="calendarDayPreviewList">{calendarDayPreviewEvents.map(event=><button type="button" key={`${event.calendarId||""}-${event.id}-${event.start}`} onClick={()=>{const returnDate=calendarDayPreview;setCalendarDayPreview(null);openEvent(event,returnDate)}}><time>{event.allDay?"종일":eventTime(event.start)}</time><span><strong>{event.title||"제목 없는 일정"}</strong><small>{[event.location,event.calendarName].filter(Boolean).join(" · ")||"세부 정보 없음"}</small></span><b>{eventStatus(event)}</b></button>)}{!calendarDayPreviewEvents.length&&<p>등록된 스케줄이 없습니다.</p>}</div>
   <div className="calendarDayPreviewActions"><button type="button" className="goldBtn" onClick={()=>{const date=calendarDayPreview;setCalendarDayPreview(null);openNewEvent(date,date)}}>+ 이 날 일정 추가</button></div>
  </section></div>}


  {editingTask&&<div className="overlay"><div className="editModal"><div className="modalHead"><h2>할 일 수정</h2><button onClick={()=>setEditingTask(null)}>닫기</button></div><label>할 일<input value={editingTask.title} onChange={e=>setEditingTask({...editingTask,title:e.target.value})}/></label><label>메모<textarea value={editingTask.note??""} onChange={e=>setEditingTask({...editingTask,note:e.target.value})}/></label><div className="twoFields"><label>기간<select value={editingTask.bucket} onChange={e=>setEditingTask({...editingTask,bucket:e.target.value as TaskBucket})}>{Object.entries(bucketLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>프로젝트<select value={editingTask.projectId??""} onChange={e=>setEditingTask({...editingTask,projectId:e.target.value||undefined})}><option value="">없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><ContextPicker contexts={local.contexts} label="맥락" value={editingTask.contextId} onChange={contextId=>setEditingTask({...editingTask,contextId})}/><div className="twoFields"><label>기한·처리 시각 (선택)<input type="datetime-local" value={editingTask.scheduledAt} onChange={e=>setEditingTask({...editingTask,scheduledAt:e.target.value})}/></label><label>예상 시간(분)<input type="number" value={editingTask.durationMinutes} onChange={e=>setEditingTask({...editingTask,durationMinutes:Number(e.target.value)})}/></label></div>{editingTask.calendarEventId&&<small className="legacyCalendarLinkNote">기존에 연결된 Calendar 일정은 데이터 보호를 위해 유지됩니다.</small>}<button className="goldBtn" onClick={saveTaskEdit}>저장</button></div></div>}
  {editingActivity&&<div className="overlay"><div className="editModal"><div className="modalHead"><h2>활동 기록 수정</h2><button onClick={()=>setEditingActivity(null)}>닫기</button></div><div className="twoFields"><label>종류<select value={editingActivity.type} onChange={e=>setEditingActivity({...editingActivity,type:e.target.value as ActivityType})}>{Object.entries(activityLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>날짜<input type="date" value={editingActivity.date} onChange={e=>setEditingActivity({...editingActivity,date:e.target.value})}/></label></div><label>제목<input value={editingActivity.title} onChange={e=>setEditingActivity({...editingActivity,title:e.target.value})}/></label><div className="twoFields"><label>시간(분)<input type="number" value={editingActivity.duration} onChange={e=>setEditingActivity({...editingActivity,duration:Number(e.target.value)})}/></label><label>수치<input type="number" step="0.1" value={editingActivity.amount} onChange={e=>setEditingActivity({...editingActivity,amount:Number(e.target.value)})}/></label></div><label>프로젝트<select value={editingActivity.projectId??""} onChange={e=>setEditingActivity({...editingActivity,projectId:e.target.value||undefined})}><option value="">없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>기록<textarea value={editingActivity.note} onChange={e=>setEditingActivity({...editingActivity,note:e.target.value})}/></label><label>배운 것<textarea value={editingActivity.learned} onChange={e=>setEditingActivity({...editingActivity,learned:e.target.value})}/></label><label>적용할 것<textarea value={editingActivity.applied} onChange={e=>setEditingActivity({...editingActivity,applied:e.target.value})}/></label><button className="goldBtn" onClick={saveActivityEdit}>저장</button></div></div>}
  {editingNote&&<div className="overlay"><div className="editModal"><div className="modalHead"><h2>노트 수정</h2><button onClick={()=>setEditingNote(null)}>닫기</button></div><div className="twoFields"><label>분류<select value={editingNote.type} onChange={e=>setEditingNote({...editingNote,type:e.target.value as NoteType})}>{Object.entries(noteLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>날짜<input type="date" value={editingNote.date} onChange={e=>setEditingNote({...editingNote,date:e.target.value})}/></label></div><label>제목<input value={editingNote.title} onChange={e=>setEditingNote({...editingNote,title:e.target.value})}/></label><label>프로젝트<select value={editingNote.projectId??""} onChange={e=>setEditingNote({...editingNote,projectId:e.target.value||undefined})}><option value="">없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>내용<textarea value={editingNote.body} onChange={e=>setEditingNote({...editingNote,body:e.target.value})}/></label><button className="goldBtn" onClick={saveNoteEdit}>저장</button></div></div>}
  {editingPerson&&<div className="overlay"><div className="editModal personModal"><div className="modalHead"><h2>관계 상세</h2><button onClick={()=>setEditingPerson(null)}>닫기</button></div><div className="twoFields"><label>이름<input value={editingPerson.name} onChange={e=>setEditingPerson({...editingPerson,name:e.target.value})}/></label><label>태그<input value={editingPerson.tags.join(", ")} onChange={e=>setEditingPerson({...editingPerson,tags:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label></div><div className="twoFields"><label>전화<input value={editingPerson.phone??""} onChange={e=>setEditingPerson({...editingPerson,phone:e.target.value})}/></label><label>이메일<input value={editingPerson.email??""} onChange={e=>setEditingPerson({...editingPerson,email:e.target.value})}/></label></div><div className="twoFields"><label>최근 연락<input type="date" value={editingPerson.lastContact} onChange={e=>setEditingPerson({...editingPerson,lastContact:e.target.value})}/></label><label>다음 연락<input type="date" value={editingPerson.nextContact} onChange={e=>setEditingPerson({...editingPerson,nextContact:e.target.value})}/></label></div><label>관계 메모<textarea value={editingPerson.note} onChange={e=>setEditingPerson({...editingPerson,note:e.target.value})}/></label><section className="contactLogBox"><h3>연락 기록</h3><div className="contactLogComposer"><select value={contactChannel} onChange={e=>setContactChannel(e.target.value)}><option>문자</option><option>전화</option><option>카카오톡</option><option>이메일</option><option>대면</option></select><input value={contactSummary} onChange={e=>setContactSummary(e.target.value)} placeholder="무슨 이야기를 했는지"/><button onClick={addContactLog}>기록</button></div>{[...(editingPerson.logs??[])].reverse().map(log=><article key={log.id}><time>{log.date}</time><b>{log.channel}</b><span>{log.summary}</span></article>)}</section><button className="goldBtn" onClick={savePersonEdit}>저장</button></div></div>}


  {pageLoading&&<div className="pageSkeleton" aria-hidden="true"><div></div><div></div><div></div></div>}
  {searchOpen&&<div className="overlay commandOverlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false)}}>
   <section className="commandPalette">
    <div className="commandHead"><span>전체 검색</span><button onClick={()=>setSearchOpen(false)}>Esc</button></div>
    <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="할 일·프로젝트·사람·활동·노트 검색"/>
    <div className="commandResults">
     {searchResults.slice(0,12).map((r,i)=><button key={i} onClick={()=>openSearchResult(r.kind)}><span>{r.kind}</span><div><strong>{r.title}</strong>{r.note&&<small>{r.note}</small>}</div></button>)}
     {!search.trim()&&<p>검색어를 입력하세요. <b>Ctrl+N</b>은 새 일정입니다.</p>}
     {search.trim()&&!searchResults.length&&<p>검색 결과가 없습니다.</p>}
    </div>
   </section>
  </div>}
  {toast&&<div className={`appToast ${toast.kind}`} role="status"><span>{toast.message}</span><button onClick={()=>setToast(null)}>×</button></div>}


  {projectDialog==="project"&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setProjectDialog(null)}}>
   <section className="jeongDialog">
    <div className="dialogHeader"><div><span>새 프로젝트</span><h2>무엇을 현실로 만들까요?</h2><p>이름과 완료됐을 때의 모습을 먼저 정합니다.</p></div><button className="dialogClose" onClick={()=>setProjectDialog(null)}>×</button></div>
    <label><span>프로젝트 이름</span><input autoFocus value={newProjectName} onChange={e=>setNewProjectName(e.target.value)} placeholder="예: JEONG 실사용판 완성"/></label>
    <label><span>프로젝트 목표</span><textarea value={newProjectGoal} onChange={e=>setNewProjectGoal(e.target.value)} placeholder="완료했을 때 어떤 상태가 되어야 하나요?"/></label>
    <div className="twoFields"><label><span>시작일</span><input type="date" value={newProjectStartDate} onChange={e=>setNewProjectStartDate(e.target.value)}/></label><label><span>마감일</span><input type="date" value={newProjectDueDate} onChange={e=>setNewProjectDueDate(e.target.value)}/></label></div>
    <div className="dialogActions"><button className="btnSecondary" onClick={()=>setProjectDialog(null)}>취소</button><button className="goldBtn" onClick={createProject}>프로젝트 만들기</button></div>
   </section>
  </div>}
  {projectDialog==="milestone"&&selectedProjectData&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setProjectDialog(null)}}>
   <section className="jeongDialog">
    <div className="dialogHeader"><div><span>{selectedProjectData.name}</span><h2>중간 목표 추가</h2><p>완료 여부가 프로젝트 진행률에 반영됩니다.</p></div><button className="dialogClose" onClick={()=>setProjectDialog(null)}>×</button></div>
    <label><span>중간 목표 이름</span><input autoFocus value={newMilestoneTitle} onChange={e=>setNewMilestoneTitle(e.target.value)} placeholder="예: Google Calendar 안정화"/></label>
    <div className="milestoneDialogMeta">
     <label><span>시작일</span><input type="date" value={newMilestoneStartDate} onChange={e=>setNewMilestoneStartDate(e.target.value)}/></label>
     <label><span>마감일</span><input type="date" min={newMilestoneStartDate||undefined} value={newMilestoneDueDate} onChange={e=>setNewMilestoneDueDate(e.target.value)}/></label>
     <label><span>진행률 반영 비중</span><div className="dialogUnitInput"><input type="number" min="0" max="100" value={newMilestoneWeight} onChange={e=>setNewMilestoneWeight(Number(e.target.value))}/><b>%</b></div></label>
    </div>
    <p className="milestoneInheritedDateHint">시작일·마감일을 비워두면 프로젝트 기간을 그대로 사용합니다. 프로젝트 기간이 바뀌면 함께 따라갑니다.</p>
    <div className="milestoneRoutinePicker">
     <div><span>연결 루틴</span><small>이 중간목표를 위해 반복할 프로젝트 루틴을 선택합니다.</small></div>
     <div>{local.recurringTasks.filter(task=>task.projectId===selectedProjectData.id).map(task=><label key={task.id}><input type="checkbox" checked={newMilestoneRoutineIds.includes(task.id)} onChange={e=>setNewMilestoneRoutineIds(current=>e.target.checked?[...current,task.id]:current.filter(id=>id!==task.id))}/><span>{task.title}</span><small>{describeRecurrence(task)}</small></label>)}{!local.recurringTasks.some(task=>task.projectId===selectedProjectData.id)&&<p>먼저 프로젝트 루틴을 추가하면 여기서 연결할 수 있습니다.</p>}</div>
    </div>
    <div className="dialogActions"><button className="btnSecondary" onClick={()=>{setNewMilestoneRoutineIds([]);setProjectDialog(null)}}>취소</button><button className="goldBtn" onClick={createMilestone}>중간 목표 추가</button></div>
   </section>
  </div>}

  {eventForm&&<div className="overlay"><form className="eventModal advancedEventModal compactEventModal" onSubmit={saveEvent}>
 <div className="modalHead eventModalHead"><div><span>Google Calendar</span><h2>{eventForm.id?"일정 수정":"일정 추가"}</h2></div><button type="button" className="btnSecondary modalCloseBtn" onClick={closeEventEditor}>닫기</button></div>
 <div className="eventCoreStack">
  <label>제목<input required autoFocus value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/></label>
  <label className="checkRow eventAllDayToggle"><input type="checkbox" checked={eventForm.allDay} onChange={e=>{const startDate=dateInput(eventForm.start);const endDate=dateInput(eventForm.end);setEventForm({...eventForm,allDay:e.target.checked,start:e.target.checked?startDate:`${startDate}T09:00`,end:e.target.checked?endDate:`${endDate}T10:00`})}}/>종일 일정</label>
  <div className="twoFields eventTimeFields"><EventDateTimeField label="시작" value={eventForm.start} allDay={eventForm.allDay} onChange={value=>setEventForm({...eventForm,start:value})}/><EventDateTimeField label="종료" value={eventForm.end} allDay={eventForm.allDay} onChange={value=>setEventForm({...eventForm,end:value})}/></div>
  <div className="eventCoreOptions eventCoreOptionsTriple"><ContextPicker contexts={local.contexts} label="맥락" value={eventForm.contextId} onChange={contextId=>setEventForm({...eventForm,contextId,calendarId:eventForm.id?eventForm.calendarId:(contextId?getDefaultCalendarId(local.contextCalendarPreferences,local.calendarContextMappings,contextId,eventForm.calendarId):eventForm.calendarId)})}/><label>반복<select value={eventForm.recurrence} onChange={e=>setEventForm({...eventForm,recurrence:e.target.value as Recurrence})}><option value="none">반복 안 함</option><option value="daily">매일</option><option value="weekdays">평일마다</option><option value="weekly">매주</option><option value="biweekly">격주</option><option value="monthly">매월</option><option value="yearly">매년</option><option value="custom">직접 설정</option></select></label><div className="eventReminderInline"><span>알림</span><div><label className="eventReminderToggle"><input type="checkbox" checked={eventForm.reminders.length>0||eventForm.useDefaultReminders} onChange={e=>setEventForm({...eventForm,useDefaultReminders:false,reminders:e.target.checked?[eventForm.reminders[0]??30]:[]})}/><span>사용</span></label><select aria-label="알림 시간" disabled={eventForm.reminders.length===0&&!eventForm.useDefaultReminders} value={eventForm.reminders[0]??30} onChange={e=>setEventForm({...eventForm,useDefaultReminders:false,reminders:[Number(e.target.value)]})}><option value="0">정시</option><option value="5">5분 전</option><option value="10">10분 전</option><option value="30">30분 전</option><option value="60">1시간 전</option><option value="120">2시간 전</option><option value="1440">1일 전</option><option value="2880">2일 전</option><option value="10080">1주 전</option></select></div></div></div>
  {eventForm.recurrence!=="none"&&<small className="eventRecurrenceHint">이 일정 안에서 반복 간격·요일·종료 조건·주말/공휴일 처리를 설정합니다.</small>}
 </div>

 {eventForm.recurrence!=="none"&&<details className="eventOptionSection eventCollapsible recurrenceSection" open>
  <summary>반복 상세 설정</summary>
  <div className="eventCollapsibleBody">
   <div className="recurrenceRuleRow">
    <div className="recurrenceInlineGroup recurrenceIntervalGroup"><span className="recurrenceInlineLabel">반복 간격</span><div className="intervalInput"><span>매</span><input type="number" min="1" max="52" value={eventForm.recurrenceInterval} onChange={e=>setEventForm({...eventForm,recurrenceInterval:Math.max(1,Number(e.target.value))})}/><b>{eventForm.recurrence==="yearly"?"년":eventForm.recurrence==="monthly"?"개월":eventForm.recurrence==="daily"?"일":"주"}마다</b></div></div>
    <div className="recurrenceInlineGroup recurrenceEndGroup"><span className="recurrenceInlineLabel">반복 종료</span><select value={eventForm.recurrenceCount>0?"count":eventForm.recurrenceUntil?"until":"never"} onChange={e=>{const v=e.target.value;setEventForm({...eventForm,recurrenceCount:v==="count"?Math.max(1,eventForm.recurrenceCount||1):0,recurrenceUntil:v==="until"?(eventForm.recurrenceUntil||eventForm.start.slice(0,10)):""})}}><option value="never">종료일 없음</option><option value="until">날짜까지</option><option value="count">횟수만큼</option></select></div>
    {eventForm.recurrenceUntil&&<div className="recurrenceInlineGroup recurrenceConditionalGroup"><span className="recurrenceInlineLabel">종료일</span><input type="date" value={eventForm.recurrenceUntil} onChange={e=>setEventForm({...eventForm,recurrenceUntil:e.target.value,recurrenceCount:0})}/></div>}
    {eventForm.recurrenceCount>0&&<div className="recurrenceInlineGroup recurrenceConditionalGroup"><span className="recurrenceInlineLabel">총 반복 횟수</span><input type="number" min="1" value={eventForm.recurrenceCount} onChange={e=>setEventForm({...eventForm,recurrenceCount:Math.max(1,Number(e.target.value)),recurrenceUntil:""})}/></div>}
   </div>
   {(eventForm.recurrence==="weekly"||eventForm.recurrence==="biweekly"||eventForm.recurrence==="custom")&&<><div className="weekdayQuickPicks"><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["MO","TU","WE","TH","FR"]})}>평일</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["SA","SU"]})}>주말</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["MO","WE","FR"]})}>월·수·금</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["TU","TH"]})}>화·목</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["MO","TU","WE","TH","FR","SA","SU"]})}>매일</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:[]})}>전체 해제</button></div><div className="weekdayBlock"><span>반복할 요일</span><div className="weekdayPicker">{[["MO","월"],["TU","화"],["WE","수"],["TH","목"],["FR","금"],["SA","토"],["SU","일"]].map(([v,l])=><label key={v} className={eventForm.weeklyDays.includes(v)?"selected":""}><input type="checkbox" checked={eventForm.weeklyDays.includes(v)} onChange={e=>setEventForm({...eventForm,weeklyDays:e.target.checked?[...eventForm.weeklyDays,v]:eventForm.weeklyDays.filter(x=>x!==v)})}/>{l}</label>)}</div></div></>}
   {eventForm.recurrence==="monthly"&&<label className="monthlyModeLabel">매월 반복 방식<select value={eventForm.monthlyMode} onChange={e=>setEventForm({...eventForm,monthlyMode:e.target.value as EventForm["monthlyMode"]})}><option value="date">같은 날짜</option><option value="lastDay">매월 마지막 날</option><option value="nthWeekday">같은 주차·요일</option><option value="lastWeekday">매월 마지막 같은 요일</option></select></label>}
   <div className="exceptionOptions"><label><input type="checkbox" checked={eventForm.excludeWeekends} onChange={e=>setEventForm({...eventForm,excludeWeekends:e.target.checked})}/>토요일·일요일 제외</label><label><input type="checkbox" checked={eventForm.excludeHolidays} onChange={e=>setEventForm({...eventForm,excludeHolidays:e.target.checked})}/>대한민국 공휴일 처리</label>{eventForm.excludeHolidays&&<select value={eventForm.holidayPolicy} onChange={e=>setEventForm({...eventForm,holidayPolicy:e.target.value as EventForm["holidayPolicy"]})}><option value="skip">건너뛰기</option><option value="next">다음 평일로 이동</option><option value="previous">이전 평일로 이동</option></select>}</div>
   {(eventForm.excludeHolidays||eventForm.excludeWeekends)&&<p className="optionHint">제외 날짜는 Google Calendar 반복 예외일로 저장됩니다. 종료일이 없으면 우선 1년 범위에서 적용합니다.</p>}
   {eventForm.seriesId&&<label>수정 범위<select value={eventForm.editScope} onChange={e=>setEventForm({...eventForm,editScope:e.target.value as "single"|"future"|"series"})}><option value="single">이 일정만</option><option value="future">이 일정과 이후 일정</option><option value="series">반복 일정 전체</option></select></label>}
  </div>
 </details>}

 <label className="eventMemoField">메모<textarea value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})} placeholder="장소, 참석자, 준비물 등 필요한 내용을 자유롭게 적으세요."/></label>

 <div className="modalActions eventModalActions compactEventActions">
  {eventForm.id&&<div className="deleteActionGroup">{eventForm.seriesId?<><button type="button" className="dangerBtn" onClick={()=>deleteEvent("single")}>이 일정만 삭제</button><button type="button" className="btnDangerOutline" onClick={()=>deleteEvent("future")}>이 일정과 이후 삭제</button><button type="button" className="btnDangerOutline" onClick={()=>deleteEvent("series")}>반복 전체 삭제</button></>:<button type="button" className="dangerBtn" onClick={()=>deleteEvent("single")}>일정 삭제</button>}{events.find(x=>x.id===eventForm.id)?.htmlLink&&<button type="button" className="btnSecondary" onClick={()=>window.open(events.find(x=>x.id===eventForm.id)?.htmlLink,"_blank")}>Google에서 열기</button>}</div>}
  <button className="goldBtn primarySaveBtn" disabled={savingEvent}>{savingEvent?"저장 중…":"Google Calendar에 저장"}</button>
 </div>
 </form></div>}
 </div>
}
