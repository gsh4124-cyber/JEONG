"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "home"|"day"|"calendar"|"tasks"|"projects"|"people"|"records"|"analytics"|"activities"|"notes"|"review"|"timeline"|"chapters"|"ai"|"settings";
type AiPromptType = "morning"|"daily"|"weekly"|"project"|"free";
type CalendarMode = "month"|"week"|"day";
type TaskBucket = "today"|"week"|"month"|"someday";
type ActivityType = "running"|"workout"|"martial"|"reading"|"study"|"church"|"photo"|"other";
type NoteType = "idea"|"thought"|"question"|"principle"|"quote";
type Recurrence = "none"|"daily"|"weekdays"|"weekly"|"biweekly"|"monthly"|"yearly"|"custom";
type AiEngine = "none"|"ollama"|"openai"|"claude"|"gemini";

type EventItem = {
 id:string; title:string; start:string; end:string; location:string; description:string;
 recurrence?:string[]; reminders?:number[]; htmlLink?:string; allDay?:boolean;
 attendees?:string[]; colorId?:string; visibility?:string; transparency?:string;
 hangoutLink?:string; recurringEventId?:string; originalStart?:string;
 calendarId?:string; calendarName?:string;
};
type MailItem = { id:string; from:string; subject:string; date:string; snippet:string };
type TaskItem = { id:string; title:string; done:boolean; bucket:TaskBucket; scheduledAt:string; durationMinutes:number; syncCalendar:boolean; calendarEventId?:string; projectId?:string };
type ContactLog = { id:string; date:string; channel:string; summary:string };
type Person = { id:string; name:string; tags:string[]; lastContact:string; nextContact:string; note:string; phone?:string; email?:string; logs?:ContactLog[] };
type Milestone = { id:string; title:string; done:boolean; weight:number };
type Project = { id:string; name:string; goal:string; next:string; status:"planning"|"active"|"review"|"done"; milestones:Milestone[]; note:string };
type Activity = { id:string; date:string; type:ActivityType; title:string; duration:number; amount:number; unit:string; note:string; learned:string; applied:string; meta:Record<string,string|number>; projectId?:string };
type Note = { id:string; date:string; type:NoteType; title:string; body:string; tags:string[]; projectId?:string };
type Review = { date:string; goal:string; enjoyment:string; status:"done"|"not_done"|"changed"|""; reason:string; good:string; learned:string; joy:string; gratitude:string };
type Chapter = { id:string; title:string; startDate:string; endDate:string; description:string; active:boolean };
type LocalState = {
  morningDate:string; goal:string; reason:string; enjoyment:string; gratitude:string[];
  tasks:TaskItem[]; people:Person[]; projects:Project[]; activities:Activity[]; notes:Note[];
  reviews:Record<string,Review>; chapters:Chapter[];
};
type EventForm = {
 id?:string; seriesId?:string; title:string; start:string; end:string; allDay:boolean;
 location:string; description:string; recurrence:Recurrence; recurrenceUntil:string;
 recurrenceCount:number; recurrenceInterval:number; weeklyDays:string[];
 monthlyMode:"date"|"lastDay"|"nthWeekday"|"lastWeekday";
 holidayPolicy:"skip"|"next"|"previous";
 excludeHolidays:boolean; excludeWeekends:boolean; reminders:number[];
 attendees:string; addMeet:boolean; visibility:"default"|"public"|"private";
 transparency:"opaque"|"transparent"; colorId:string;
 editScope:"single"|"future"|"series"; calendarId:string;
};

const KEY="jeong_lifeos_v5";
const LEGACY_KEYS=["jeong_integrated_google_v33","jeong_integrated_google_v32","jeong_integrated_google_v31"];
const todayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const uid=()=>crypto.randomUUID?.()??`${Date.now()}-${Math.random()}`;
const toLocalInput=(value?:string)=>{const d=value?new Date(value):new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
const eventTime=(v:string)=>{const d=new Date(v); return Number.isNaN(d.getTime())||!v.includes("T")?"종일":d.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})};
const eventDateKey=(v:string)=>v.includes("T")?todayKey(new Date(v)):v.slice(0,10);
const dateInput=(v?:string)=>v?eventDateKey(v):todayKey();
const reminderLabel=(minutes:number)=>minutes>=10080?`${Math.round(minutes/10080)}주 전`:minutes>=1440?`${Math.round(minutes/1440)}일 전`:minutes>=60?`${Math.round(minutes/60)}시간 전`:`${minutes}분 전`;
const parseYmd=(value:string)=>{const [y,m,d]=value.slice(0,10).split("-").map(Number);return new Date(y,m-1,d)};
const formatYmd=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const addDaysYmd=(value:string,days:number)=>{const d=parseYmd(value);d.setDate(d.getDate()+days);return formatYmd(d)};
const compactYmd=(value:string)=>value.slice(0,10).replaceAll("-","");
const localTimeParts=(value:string)=>{const d=new Date(value);return `${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}${String(d.getSeconds()).padStart(2,"0")}`};
const colorLabels:Record<string,string>={"":"기본","1":"라벤더","2":"세이지","3":"포도","4":"플라밍고","5":"바나나","6":"귤","7":"피콕","8":"흑연","9":"블루베리","10":"바질","11":"토마토"};
const activityLabels:Record<ActivityType,string>={running:"러닝",workout:"근력 운동",martial:"무도",reading:"독서",study:"공부",church:"교회·교육",photo:"사진",other:"기타"};
const noteLabels:Record<NoteType,string>={idea:"아이디어",thought:"생각",question:"질문",principle:"기준",quote:"어록"};
const bucketLabels:Record<TaskBucket,string>={today:"오늘",week:"이번 주",month:"이번 달",someday:"언젠가"};
const defaultProjects:Project[]=[
 {id:"insurance",name:"우리동네 보험점검",goal:"지역에서 신뢰받는 보험 점검 채널과 고객 흐름 구축",next:"고객 또는 콘텐츠와 연결되는 행동 하나",status:"active",note:"",milestones:[{id:"i1",title:"콘텐츠 운영 체계",done:false,weight:30},{id:"i2",title:"고객 관리 체계",done:false,weight:35},{id:"i3",title:"지역 제휴 체계",done:false,weight:35}]},
 {id:"jeong",name:"JEONG",goal:"황제가 실제로 매일 사용하는 개인 운영체제 완성",next:"실사용에서 불편한 기능 하나 개선",status:"active",note:"",milestones:[{id:"j1",title:"Google 연동",done:true,weight:20},{id:"j2",title:"하루 운영",done:true,weight:20},{id:"j3",title:"프로젝트·사람",done:false,weight:20},{id:"j4",title:"활동·기록",done:false,weight:20},{id:"j5",title:"AI·Life Graph",done:false,weight:20}]},
 {id:"nextlevel",name:"넥스트레벨",goal:"자기 삶을 찾고 살아가도록 돕는 구조 설계",next:"구조 한 부분 정리",status:"planning",note:"",milestones:[]},
 {id:"running",name:"We are Run",goal:"러닝과 사유를 연결한 신뢰도 높은 채널 운영",next:"러닝 기록 또는 콘텐츠 하나",status:"active",note:"",milestones:[]},
 {id:"education",name:"교회·교육",goal:"학생이 스스로 생각하도록 돕는 교육",next:"가까운 수업 준비 확인",status:"active",note:"",milestones:[]}
];
const defaultState:LocalState={
 morningDate:"",goal:"",reason:"",enjoyment:"",gratitude:["","",""] ,tasks:[],people:[],projects:defaultProjects,activities:[],notes:[],reviews:{},chapters:[{id:"c1",title:"JEONG를 현실로 만드는 시기",startDate:todayKey(),endDate:"",description:"생각을 실제로 사용하는 시스템으로 만드는 챕터",active:true}]
};
function loadState():LocalState{
 if(typeof window==="undefined") return defaultState;
 const raw=localStorage.getItem(KEY)??LEGACY_KEYS.map(k=>localStorage.getItem(k)).find(Boolean)??null;
 if(!raw) return defaultState;
 try{
  const s=JSON.parse(raw);
  const people=(s.people??s.contacts??[]).map((p:any)=>({id:p.id??uid(),name:p.name??"",tags:p.tags??["보험"],lastContact:p.lastContact??"",nextContact:p.nextContact??p.date??"",note:p.note??p.purpose??"",phone:p.phone??"",email:p.email??"",logs:Array.isArray(p.logs)?p.logs:[]}));
  const projects=(s.projects?.length?s.projects:defaultProjects).map((p:any)=>({id:p.id??uid(),name:p.name??"프로젝트",goal:p.goal??"",next:p.next??"",status:p.status??"active",note:p.note??"",milestones:p.milestones??[]}));
  const notes=s.notes??Object.entries(s.memory??{}).filter(([,v])=>v).map(([type,body])=>({id:uid(),date:todayKey(),type:type==="principle"?"principle":"thought",title:noteLabels[(type==="principle"?"principle":"thought") as NoteType],body:String(body),tags:[]}));
  return {...defaultState,...s,people,projects,notes,activities:s.activities??[],reviews:s.reviews??{},chapters:s.chapters??defaultState.chapters,gratitude:Array.isArray(s.gratitude)?s.gratitude:["","",""]};
 }catch{return defaultState}
}
function progress(p:Project){const total=p.milestones.reduce((a,m)=>a+Math.max(0,m.weight),0); if(!total)return p.status==="done"?100:0; return Math.round(p.milestones.filter(m=>m.done).reduce((a,m)=>a+m.weight,0)/total*100)}
function monthDays(cursor:Date){const first=new Date(cursor.getFullYear(),cursor.getMonth(),1); const start=new Date(cursor.getFullYear(),cursor.getMonth(),1-first.getDay()); return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})}
function rangeFor(mode:CalendarMode,cursor:Date){if(mode==="month"){const days=monthDays(cursor);const start=new Date(days[0]);start.setHours(0,0,0,0);const end=new Date(days[days.length-1]);end.setDate(end.getDate()+1);end.setHours(0,0,0,0);return {start,end}}; if(mode==="week"){const s=new Date(cursor);s.setDate(s.getDate()-s.getDay());s.setHours(0,0,0,0);const e=new Date(s);e.setDate(e.getDate()+7);return {start:s,end:e}} const s=new Date(cursor);s.setHours(0,0,0,0);const e=new Date(s);e.setDate(e.getDate()+1);return {start:s,end:e}}
function emptyReview(date:string,state:LocalState):Review{return {date,goal:date===todayKey()?state.goal:"",enjoyment:date===todayKey()?state.enjoyment:"",status:"",reason:"",good:"",learned:"",joy:"",gratitude:""}}
function eventStatus(e:EventItem){const n=Date.now(),s=new Date(e.start).getTime(),end=new Date(e.end).getTime(); if(n>=end)return "완료"; if(n>=s)return "진행 중"; return "예정"}
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

export function Dashboard(){
 const [local,setLocal]=useState<LocalState>(defaultState); const [hydrated,setHydrated]=useState(false); const [theme,setTheme]=useState<"light"|"dark">("light");
 const [view,setView]=useState<View>("home"); const [search,setSearch]=useState(""); const [showMorning,setShowMorning]=useState(false);
 const [events,setEvents]=useState<EventItem[]>([]); const [mails,setMails]=useState<MailItem[]>([]); const [loading,setLoading]=useState(false); const [calendarError,setCalendarError]=useState("");
 const [calendarMode,setCalendarMode]=useState<CalendarMode>("month"); const [cursor,setCursor]=useState(new Date()); const [selectedDate,setSelectedDate]=useState(new Date()); const [eventForm,setEventForm]=useState<EventForm|null>(null);
 const [showSelectedDay,setShowSelectedDay]=useState(true);
 const [calendarOptions,setCalendarOptions]=useState<{id:string;name:string;primary:boolean;color?:string}[]>([]);
 const [visibleCalendarIds,setVisibleCalendarIds]=useState<string[]>(["primary"]);
 const [aiEngine,setAiEngine]=useState<AiEngine>("none");
 const [aiModel,setAiModel]=useState("llama3.2:3b");
 const [aiStatus,setAiStatus]=useState("");
 const [taskBucket,setTaskBucket]=useState<TaskBucket>("today"); const [taskTitle,setTaskTitle]=useState(""); const [taskWhen,setTaskWhen]=useState(""); const [taskDuration,setTaskDuration]=useState(60); const [taskSync,setTaskSync]=useState(false);
 const [selectedProject,setSelectedProject]=useState<string>("jeong"); const [personName,setPersonName]=useState(""); const [personTag,setPersonTag]=useState("보험");
 const [activityType,setActivityType]=useState<ActivityType>("running"); const [activityTitle,setActivityTitle]=useState(""); const [activityDate,setActivityDate]=useState(todayKey()); const [activityDuration,setActivityDuration]=useState(60); const [activityAmount,setActivityAmount]=useState(0); const [activityNote,setActivityNote]=useState(""); const [activityLearned,setActivityLearned]=useState(""); const [activityApplied,setActivityApplied]=useState("");
 const [noteType,setNoteType]=useState<NoteType>("idea"); const [noteTitle,setNoteTitle]=useState(""); const [noteBody,setNoteBody]=useState(""); const [reviewDate,setReviewDate]=useState(todayKey());
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
 const [aiPrompt,setAiPrompt]=useState("");
 const [aiIncludePeople,setAiIncludePeople]=useState(false);
 const [aiCopied,setAiCopied]=useState(false);

 useEffect(()=>{const s=loadState();setLocal(s);setShowMorning(s.morningDate!==todayKey());const t=(localStorage.getItem("jeong_theme") as "light"|"dark"|null)??"light";setTheme(t);document.documentElement.dataset.theme=t;
 setAiEngine((localStorage.getItem("jeong_ai_engine") as AiEngine|null)??"none");setAiModel(localStorage.getItem("jeong_ai_model")??"llama3.2:3b");
 const savedCalendars=localStorage.getItem("jeong_visible_calendars");if(savedCalendars){try{setVisibleCalendarIds(JSON.parse(savedCalendars))}catch{}}
 setHydrated(true)},[]);
 useEffect(()=>{if(hydrated)localStorage.setItem(KEY,JSON.stringify(local))},[local,hydrated]);
 const update=<K extends keyof LocalState>(key:K,value:LocalState[K])=>setLocal(s=>({...s,[key]:value}));
 const toggleTheme=()=>{const n=theme==="light"?"dark":"light";setTheme(n);localStorage.setItem("jeong_theme",n);document.documentElement.dataset.theme=n};

 async function loadCalendar(){
 setLoading(true);setCalendarError("");
 const r=rangeFor(calendarMode,cursor);
 const q=new URLSearchParams({start:r.start.toISOString(),end:r.end.toISOString(),calendarIds:visibleCalendarIds.join(",")});
 try{
  const [cr,mr,lr]=await Promise.all([
   fetch(`/api/calendar?${q}`,{cache:"no-store"}),
   fetch("/api/gmail",{cache:"no-store"}),
   fetch("/api/calendar/calendars",{cache:"no-store"})
  ]);
  if(cr.ok)setEvents((await cr.json()).events??[]);else setCalendarError("Google Calendar를 불러오지 못했습니다.");
  if(mr.ok)setMails((await mr.json()).messages??[]);
  if(lr.ok){const list=(await lr.json()).calendars??[];setCalendarOptions(list);if(!visibleCalendarIds.length&&list.length)setVisibleCalendarIds(list.filter((x:any)=>x.primary).map((x:any)=>x.id))}
 }finally{setLoading(false)}
}
 useEffect(()=>{if(hydrated)loadCalendar()},[hydrated,calendarMode,cursor,visibleCalendarIds.join("|")]);
 useEffect(()=>{if(hydrated)localStorage.setItem("jeong_visible_calendars",JSON.stringify(visibleCalendarIds))},[visibleCalendarIds,hydrated]);

 const currentReview=local.reviews[reviewDate]??emptyReview(reviewDate,local);
 const updateReview=(patch:Partial<Review>)=>setLocal(s=>({...s,reviews:{...s.reviews,[reviewDate]:{...(s.reviews[reviewDate]??emptyReview(reviewDate,s)),...patch,date:reviewDate}}}));
 const todayEvents=events.filter(e=>eventDateKey(e.start)===todayKey());
 const selectedDateKey=todayKey(selectedDate);
 const selectedDateEvents=events.filter(e=>eventDateKey(e.start)===selectedDateKey).sort((a,b)=>a.start.localeCompare(b.start));
 const todayTasks=local.tasks.filter(t=>t.bucket==="today"&&!t.done);
 const duePeople=local.people.filter(p=>p.nextContact&&p.nextContact<=todayKey());
 const activeProjects=local.projects.filter(p=>p.status!=="done");
 const hour=new Date().getHours(); const greeting=hour<12?"좋은 아침입니다, 황제.":hour<18?"좋은 오후입니다, 황제.":"좋은 저녁입니다, 황제.";
 const briefing=[todayEvents.length?`오늘 일정 ${todayEvents.length}건`:`오늘 일정 없음`,todayTasks.length?`오늘 할 일 ${todayTasks.length}건`:`오늘 할 일 없음`,duePeople.length?`연락 확인 ${duePeople.length}건`:`연락 확인 없음`,activeProjects.length?`진행 프로젝트 ${activeProjects.length}개`:"진행 프로젝트 없음"];
 const selectedProjectData=local.projects.find(p=>p.id===selectedProject)??local.projects[0];
 const reviewDates=Object.keys(local.reviews).sort((a,b)=>b.localeCompare(a));
 const timeline=[...local.activities.map(a=>({date:a.date,kind:activityLabels[a.type],title:a.title,note:a.note})),...local.notes.map(n=>({date:n.date,kind:noteLabels[n.type],title:n.title,note:n.body})),...Object.values(local.reviews).map(r=>({date:r.date,kind:"리뷰",title:r.goal||"하루 리뷰",note:r.joy||r.good})),...local.tasks.filter(t=>t.done).map(t=>({date:t.scheduledAt?.slice(0,10)||todayKey(),kind:"완료",title:t.title,note:""}))].sort((a,b)=>b.date.localeCompare(a.date));
 const monthPrefix=todayKey().slice(0,7); const monthActivities=local.activities.filter(a=>a.date.startsWith(monthPrefix));
 const searchResults=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return[];return [
  ...local.tasks.filter(x=>x.title.toLowerCase().includes(q)).map(x=>({kind:"할 일",title:x.title,note:bucketLabels[x.bucket]})),
  ...local.projects.filter(x=>(x.name+x.goal+x.next+x.note).toLowerCase().includes(q)).map(x=>({kind:"프로젝트",title:x.name,note:x.next})),
  ...local.people.filter(x=>(x.name+x.note+x.tags.join(" ")).toLowerCase().includes(q)).map(x=>({kind:"사람",title:x.name,note:x.tags.join(" · ")})),
  ...local.activities.filter(x=>(x.title+x.note+x.learned+x.applied).toLowerCase().includes(q)).map(x=>({kind:activityLabels[x.type],title:x.title,note:x.note})),
  ...local.notes.filter(x=>(x.title+x.body+x.tags.join(" ")).toLowerCase().includes(q)).map(x=>({kind:noteLabels[x.type],title:x.title,note:x.body}))
 ]},[search,local]);

 function saveMorning(e:FormEvent){e.preventDefault();setLocal(s=>({...s,morningDate:todayKey()}));setShowMorning(false)}
 function defaultEventForm(date=selectedDate):EventForm{
  const st=new Date(date);st.setHours(9,0,0,0);const en=new Date(st);en.setHours(10,0,0,0);
  return {title:"",start:toLocalInput(st.toISOString()),end:toLocalInput(en.toISOString()),allDay:false,location:"",description:"",
   recurrence:"none",recurrenceUntil:"",recurrenceCount:0,recurrenceInterval:1,weeklyDays:[],
   monthlyMode:"date",holidayPolicy:"skip",excludeHolidays:false,excludeWeekends:false,reminders:[30],attendees:"",addMeet:false,
   visibility:"default",transparency:"opaque",colorId:"",editScope:"single",calendarId:visibleCalendarIds[0]||"primary"};
 }
 function openNewEvent(date=selectedDate){setEventForm(defaultEventForm(date))}
 function parseRecurrence(lines:string[]|undefined,start:string){
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
 async function openEvent(e:EventItem){
  const master=e.recurringEventId?await fetchSeriesMaster(e.recurringEventId,e.calendarId||"primary"):e;
  const parsed=parseRecurrence(master?.recurrence,e.start);
  setEventForm({id:e.id,seriesId:e.recurringEventId,title:e.title,
   start:e.allDay?dateInput(e.start):toLocalInput(e.start),
   end:e.allDay?dateInput(e.end):toLocalInput(e.end),allDay:!!e.allDay,location:e.location,description:e.description,
   ...parsed,excludeHolidays:false,excludeWeekends:false,holidayPolicy:"skip",
   reminders:e.reminders?.length?e.reminders:[30],attendees:(e.attendees??[]).join(", "),addMeet:!!e.hangoutLink,
   visibility:(e.visibility as EventForm["visibility"])??"default",transparency:(e.transparency as EventForm["transparency"])??"opaque",
   colorId:e.colorId??"",editScope:e.recurringEventId?"single":"series",calendarId:e.calendarId||"primary"});
 } async function saveEvent(e:FormEvent){
  e.preventDefault();if(!eventForm)return;
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
  const body={...eventForm,id:targetId,instanceId:eventForm.id,
   splitFrom:eventForm.start,calendarId:eventForm.calendarId,
   start:eventForm.allDay?eventForm.start:new Date(eventForm.start).toISOString(),
   end:eventForm.allDay?eventForm.end:new Date(eventForm.end).toISOString(),
   recurrence:recurrenceLines,attendees:eventForm.attendees.split(",").map(x=>x.trim()).filter(Boolean)};
  const method=targetId?"PATCH":"POST";
  const r=await fetch("/api/calendar",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok){const detail=await r.text();alert(`Google Calendar 저장에 실패했습니다.\n${detail.slice(0,300)}`);return}
  setEventForm(null);await loadCalendar();
 }
 async function deleteEvent(scope:"single"|"future"|"series"="single"){
  if(!eventForm?.id)return;
  const isSeries=!!eventForm.seriesId;
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
  setEventForm(null);await loadCalendar();
 }
 async function testAiEngine(){
  localStorage.setItem("jeong_ai_engine",aiEngine);localStorage.setItem("jeong_ai_model",aiModel);
  if(aiEngine==="none"){setAiStatus("AI 엔진을 선택하지 않았습니다.");return}
  if(aiEngine!=="ollama"){setAiStatus("연결 구조가 준비되었습니다. 나중에 API 키를 설정하면 사용할 수 있습니다.");return}
  setAiStatus("로컬 AI 확인 중…");
  try{const r=await fetch("/api/ai/status?engine=ollama");const data=await r.json();setAiStatus(data.ok?`Ollama 연결됨 · ${data.models?.length??0}개 모델`:"Ollama가 실행 중이지 않습니다.");}
  catch{setAiStatus("로컬 AI에 연결하지 못했습니다.");}
 }
 async function addTask(){if(!taskTitle.trim())return;const task:TaskItem={id:uid(),title:taskTitle.trim(),done:false,bucket:taskBucket,scheduledAt:taskWhen,durationMinutes:taskDuration,syncCalendar:taskSync,projectId:taskProject||undefined};if(taskSync){if(!taskWhen)return alert("캘린더 저장에는 날짜와 시간이 필요합니다.");const s=new Date(taskWhen),e=new Date(s.getTime()+taskDuration*60000);const r=await fetch("/api/calendar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:task.title,start:s.toISOString(),end:e.toISOString(),location:"",description:"JEONG 할 일",recurrence:[],reminders:[30]})});if(!r.ok)return alert("캘린더 저장에 실패했습니다.");task.calendarEventId=(await r.json()).event?.id;loadCalendar()}update("tasks",[...local.tasks,task]);setTaskTitle("");setTaskWhen("");setTaskSync(false)}
 function addPerson(){if(!personName.trim())return;update("people",[...local.people,{id:uid(),name:personName.trim(),tags:[personTag],lastContact:"",nextContact:"",note:""}]);setPersonName("")}
 function addActivity(){if(!activityTitle.trim())return;const unit=activityType==="running"?"km":activityType==="reading"?"page":activityType==="workout"?"세트":"";update("activities",[...local.activities,{id:uid(),date:activityDate,type:activityType,title:activityTitle,duration:activityDuration,amount:activityAmount,unit,note:activityNote,learned:activityLearned,applied:activityApplied,meta:{},projectId:activityProject||undefined}]);setActivityTitle("");setActivityNote("");setActivityLearned("");setActivityApplied("");setActivityAmount(0)}
 function addNote(){if(!noteTitle.trim()&&!noteBody.trim())return;update("notes",[...local.notes,{id:uid(),date:todayKey(),type:noteType,title:noteTitle||noteLabels[noteType],body:noteBody,tags:[],projectId:noteProject||undefined}]);setNoteTitle("");setNoteBody("")}
 function addChapter(){if(!chapterTitle.trim())return;update("chapters",[...local.chapters.map(c=>({...c,active:false})),{id:uid(),title:chapterTitle,startDate:todayKey(),endDate:"",description:chapterDescription,active:true}]);setChapterTitle("");setChapterDescription("")}


 async function saveTaskEdit(){
  if(!editingTask)return;
  const old=local.tasks.find(t=>t.id===editingTask.id);
  let next={...editingTask};
  if(next.syncCalendar&&next.scheduledAt){
   const st=new Date(next.scheduledAt), en=new Date(st.getTime()+next.durationMinutes*60000);
   const body={id:next.calendarEventId,title:next.title,start:st.toISOString(),end:en.toISOString(),location:"",description:"JEONG 할 일",recurrence:[],reminders:[30]};
   const r=await fetch("/api/calendar",{method:next.calendarEventId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!r.ok)return alert("Google Calendar 동기화에 실패했습니다.");
   if(!next.calendarEventId)next.calendarEventId=(await r.json()).event?.id;
  }else if(old?.calendarEventId&&!next.syncCalendar){
   if(confirm("연결된 Google Calendar 일정도 삭제할까요?"))await fetch(`/api/calendar?id=${encodeURIComponent(old.calendarEventId)}`,{method:"DELETE"});
   next.calendarEventId=undefined;
  }
  update("tasks",local.tasks.map(t=>t.id===next.id?next:t));setEditingTask(null);loadCalendar();
 }
 async function removeTask(t:TaskItem){
  if(t.calendarEventId&&confirm("연결된 Google Calendar 일정도 함께 삭제할까요?"))await fetch(`/api/calendar?id=${encodeURIComponent(t.calendarEventId)}`,{method:"DELETE"});
  update("tasks",local.tasks.filter(x=>x.id!==t.id));loadCalendar();
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
  reader.onload=()=>{try{const data=JSON.parse(String(reader.result));setLocal({...defaultState,...data});alert("백업을 복원했습니다.")}catch{alert("올바른 JEONG 백업 파일이 아닙니다.")}};
  reader.readAsText(file);
 }
 const dayEvents=events.filter(e=>new Date(e.start).toDateString()===new Date(`${dayDate}T00:00:00`).toDateString());
 const dayTasks=local.tasks.filter(t=>(t.scheduledAt?.slice(0,10)||"")===dayDate||(t.bucket==="today"&&dayDate===todayKey()));
 const dayActivities=local.activities.filter(a=>a.date===dayDate);
 const dayNotes=local.notes.filter(n=>n.date===dayDate);
 const dayReview=local.reviews[dayDate];


 function buildAiPrompt(type:AiPromptType){
  const today=todayKey();
  const todayEvents=events.filter(e=>new Date(e.start).toDateString()===new Date().toDateString());
  const todayTasks=local.tasks.filter(t=>!t.done&&(t.bucket==="today"||t.scheduledAt?.slice(0,10)===today));
  const weekTasks=local.tasks.filter(t=>!t.done&&(t.bucket==="week"||t.bucket==="today"));
  const todayActivities=local.activities.filter(a=>a.date===today);
  const todayReview=local.reviews[today];
  const projectLines=local.projects.map(p=>`- ${p.name}: ${progress(p)}%, 다음 행동: ${p.nextAction||"미입력"}`).join("\\n");
  const peopleLines=aiIncludePeople?local.people.filter(p=>p.nextContact&&p.nextContact<=today).map(p=>`- ${p.name}: 다음 연락 ${p.nextContact}, 태그 ${p.tags.join(", ")}`).join("\\n"):"(개인정보 보호를 위해 제외)";
  const data=`[사용자 정보]\n호칭: 황제\n\n[오늘 기준]\n날짜: ${today}\n목표: ${local.goal||"미입력"}\n이유: ${local.reason||"미입력"}\n즐길 것: ${local.enjoyment||"미입력"}\n감사: ${local.gratitude.filter(Boolean).join(" / ")||"미입력"}\n\n[오늘 일정]\n${todayEvents.map(e=>`- ${eventTime(e.start)} ${e.title}${e.location?` (${e.location})`:""}`).join("\\n")||"- 없음"}\n\n[오늘 할 일]\n${todayTasks.map(t=>`- ${t.done?"완료":"미완료"}: ${t.title}`).join("\\n")||"- 없음"}\n\n[이번 주 미완료 할 일]\n${weekTasks.map(t=>`- ${t.title}`).join("\\n")||"- 없음"}\n\n[오늘 활동]\n${todayActivities.map(a=>`- ${activityLabels[a.type]}: ${a.title}, ${a.duration}분${a.amount?`, ${a.amount}${a.unit}`:""}`).join("\\n")||"- 없음"}\n\n[프로젝트]\n${projectLines||"- 없음"}\n\n[연락 확인]\n${peopleLines||"- 없음"}\n\n[오늘 리뷰]\n${todayReview?`목표 결과: ${todayReview.status||"미선택"} / 잘한 점: ${todayReview.good||"-"} / 배운 점: ${todayReview.learned||"-"} / 즐거웠던 순간: ${todayReview.joy||"-"}`:"- 아직 없음"}`;
  const requests:Record<AiPromptType,string>={
   morning:"위 데이터를 바탕으로 오늘 아침 브리핑을 작성해줘. 사실과 일정부터 정리하고, 가장 중요한 일 1개와 준비할 것만 이유와 함께 제시해줘. 결정은 내가 할 수 있도록 선택지를 남겨줘.",
   daily:"위 데이터를 바탕으로 오늘 상태를 정리해줘. 이미 끝난 것, 남은 것, 놓치기 쉬운 것, 다음 행동 후보를 구분하고 각 제안의 이유를 짧게 설명해줘.",
   weekly:"위 데이터를 바탕으로 이번 주 점검을 해줘. 진행된 것, 멈춘 것, 다음 주로 넘길 것, 프로젝트별 다음 행동을 정리해줘. 과장하거나 새로운 사실을 만들지 마.",
   project:"위 프로젝트 정보를 중심으로 막힌 지점과 다음 행동을 정리해줘. 진행률 숫자만 보지 말고 중간 목표와 실제 기록을 기준으로 판단해줘.",
   free:"위 JEONG 데이터를 참고자료로 사용해줘. 내가 이어서 질문할 때 데이터에 없는 내용은 추측하지 말고 확인해줘."
  };
  return `너는 JEONG의 분석 파트너다. 사용자의 선택을 대신하지 말고, 흩어진 정보를 정리해 선택할 수 있게 돕는다. 업무에 필요 없는 철학적 문구와 과한 격려는 제외한다.\\n\\n${requests[type]}\\n\\n${data}`;
 }
 function prepareAi(type:AiPromptType){setAiType(type);setAiPrompt(buildAiPrompt(type));setAiCopied(false)}
 async function copyAiPrompt(){try{await navigator.clipboard.writeText(aiPrompt);setAiCopied(true)}catch{alert("복사하지 못했습니다. 텍스트를 직접 선택해 복사해 주세요.")}}
 async function openChatGPT(){if(!aiPrompt)prepareAi(aiType);await copyAiPrompt();window.open("https://chatgpt.com/","_blank","noopener,noreferrer")}


 const aiSetupGuide:Record<AiEngine,{title:string;cost:string;steps:string[];env?:string;link?:string;linkLabel?:string;note:string}>={
  none:{title:"AI 연결 안 함",cost:"추가 비용 없음",steps:["JEONG의 일정·할 일·프로젝트·기록 기능만 사용합니다.","나중에 언제든 다른 AI 엔진으로 변경할 수 있습니다."],note:"AI를 연결하지 않아도 JEONG의 기본 기능은 계속 작동합니다."},
  ollama:{title:"Ollama · 무료 로컬 AI",cost:"API 사용료 없음",steps:["Ollama Windows 버전을 설치합니다.","설치 후 PowerShell 또는 명령 프롬프트에서 ollama run llama3.2:3b 를 한 번 실행합니다.","JEONG 설정에서 모델 이름을 llama3.2:3b 로 입력합니다.","설정 저장·연결 확인을 누릅니다."],link:"https://ollama.com/download/windows",linkLabel:"Ollama Windows 다운로드",note:"AI가 내 컴퓨터에서 실행됩니다. 처음 모델을 내려받을 때 저장 공간과 시간이 필요하며, 컴퓨터 성능에 따라 응답 속도가 달라집니다."},
  openai:{title:"OpenAI API",cost:"사용량에 따라 별도 과금",steps:["OpenAI Platform에서 API 키를 생성합니다.","JEONG 폴더의 .env.local 파일을 메모장으로 엽니다.","아래 환경변수를 한 줄 추가하고 저장합니다.","JEONG 실행 창을 완전히 종료한 뒤 다시 실행합니다."],env:"OPENAI_API_KEY=발급받은_키",link:"https://platform.openai.com/api-keys",linkLabel:"OpenAI API 키 관리",note:"ChatGPT Plus 구독과 API 사용료는 별도입니다. 비밀키는 GitHub나 채팅에 올리지 마세요."},
  claude:{title:"Claude API",cost:"사용량에 따라 별도 과금",steps:["Claude Console의 Settings → API keys에서 키를 만듭니다.","JEONG 폴더의 .env.local 파일을 엽니다.","아래 환경변수를 추가하고 저장합니다.","JEONG를 완전히 종료한 뒤 다시 실행합니다."],env:"ANTHROPIC_API_KEY=발급받은_키",link:"https://console.anthropic.com/settings/keys",linkLabel:"Claude API 키 관리",note:"Claude 웹 구독과 Claude API 결제는 별도일 수 있습니다. 키는 외부에 공개하지 마세요."},
  gemini:{title:"Gemini API",cost:"무료 할당량 또는 사용량 과금 정책 적용",steps:["Google AI Studio에서 Gemini API 키를 생성합니다.","JEONG 폴더의 .env.local 파일을 엽니다.","아래 환경변수를 추가하고 저장합니다.","JEONG를 완전히 종료한 뒤 다시 실행합니다."],env:"GEMINI_API_KEY=발급받은_키",link:"https://aistudio.google.com/app/api-keys",linkLabel:"Gemini API 키 만들기",note:"사용 가능한 무료 할당량과 요금은 계정·모델·정책에 따라 달라질 수 있습니다."}
 };
 const currentAiGuide=aiSetupGuide[aiEngine];
 const viewTitles:Record<string,string>={
  home:"오늘",day:"하루 기록",calendar:"캘린더",tasks:"할 일",projects:"프로젝트",
  people:"관계",records:"전체 기록",analytics:"분석",activities:"활동 기록",
  notes:"노트",review:"리뷰",timeline:"타임라인",chapters:"삶의 시기",ai:"AI",settings:"설정"
 };


 const groups=[
  {label:"오늘",items:[{v:"home",t:"오늘"}]},
  {label:"일정",items:[{v:"calendar",t:"캘린더"},{v:"tasks",t:"할 일"}]},
  {label:"운영",items:[{v:"projects",t:"프로젝트"},{v:"people",t:"관계"}]},
  {label:"기록",items:[{v:"records",t:"전체 기록"}]},
  {label:"분석",items:[{v:"analytics",t:"분석"}]},
  {label:"AI",items:[{v:"ai",t:"AI"}]},
  {label:"",items:[{v:"settings",t:"설정"}]}
 ] as const;
 if(!hydrated)return null;
 return <div className="lifeShell">
  {showMorning&&<div className="overlay"><form className="morningCard" onSubmit={saveMorning}><div className="modalHead"><div><span>오늘 시작</span><h2>{greeting}</h2></div><button type="button" className="softBtn" onClick={()=>setShowMorning(false)}>나중에</button></div><label>오늘 목표<textarea required value={local.goal} onChange={e=>update("goal",e.target.value)}/></label><label>선택한 이유<textarea value={local.reason} onChange={e=>update("reason",e.target.value)}/></label><label>오늘 즐길 것<textarea value={local.enjoyment} onChange={e=>update("enjoyment",e.target.value)}/></label><fieldset><legend>감사 3가지</legend>{[0,1,2].map(i=><input key={i} value={local.gratitude[i]??""} onChange={e=>update("gratitude",local.gratitude.map((x,j)=>j===i?e.target.value:x))}/>)}</fieldset><button className="goldBtn">오늘 시작하기</button></form></div>}
  <aside className="premiumSidebar"><div className="brandBlock"><div className="seal">整</div><div><strong>PROJECT JEONG</strong><small>Your Private Assistant</small></div></div><div className="navScroll">{groups.map((g,gi)=><section className="navGroup" key={gi}>{g.label&&<span>{g.label}</span>}{g.items.map(i=><button key={i.v} className={view===i.v?"active":""} onClick={()=>setView(i.v as View)}>{i.t}</button>)}</section>)}</div><div className="profileChip"><div>황제</div><span>고금제일 황제 👑</span></div></aside>
  <main className="contentArea"><header className="topHeader"><div><p>{new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"})}</p><h1>{view==="home"?greeting:viewTitles[view]}</h1></div><div className="headerTools"><div className="searchBox"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="전체 검색"/>{search&&<div className="searchPopup">{searchResults.slice(0,8).map((r,i)=><article key={i}><span>{r.kind}</span><strong>{r.title}</strong><small>{r.note}</small></article>)}{!searchResults.length&&<p>검색 결과가 없습니다.</p>}</div>}</div><button className="iconBtn" onClick={toggleTheme}>{theme==="light"?"☾":"☀"}</button><button className="iconBtn" onClick={()=>setShowMorning(true)}>☰</button></div></header>

  {view==="home"&&<><section className="premiumCard homeHistoryBar"><div><span>오늘과 지난 기록</span><strong>오늘을 운영하고, 지난 하루도 같은 흐름에서 확인합니다.</strong></div><label><span>지난 날짜 보기</span><input type="date" value={dayDate} onChange={e=>{setDayDate(e.target.value);if(e.target.value!==todayKey())setView("day")}}/></label></section><div className="homeGrid"><section className="mainColumn"><article className="premiumCard morningPanel"><div className="cardTitle"><h2>🌅 오늘 아침 기록</h2><button className="goldBtn" onClick={()=>setLocal(s=>({...s,morningDate:todayKey()}))}>✓ 저장하기</button></div><div className="morningGrid"><label>🎯 1. 오늘 목표<textarea value={local.goal} onChange={e=>update("goal",e.target.value)} placeholder="오늘의 가장 중요한 목표는?"/></label><label>⭐ 2. 선택한 이유<textarea value={local.reason} onChange={e=>update("reason",e.target.value)} placeholder="왜 이 목표가 오늘 가장 중요한가?"/></label><label>💗 3. 오늘 즐길 것<textarea value={local.enjoyment} onChange={e=>update("enjoyment",e.target.value)} placeholder="오늘 무엇을 누리고 즐길 것인가?"/></label><label>🌿 4. 감사 3가지<div className="gratitudeList">{[0,1,2].map(i=><div key={i}><b>{i+1}.</b><input value={local.gratitude[i]??""} onChange={e=>update("gratitude",local.gratitude.map((x,j)=>j===i?e.target.value:x))}/></div>)}</div></label></div></article><article className="premiumCard reportPanel"><div className="cardTitle"><h2>🧠 오늘 보고</h2></div><div className="briefBubble"><strong>현재 상태</strong>{briefing.map(x=><p key={x}>• {x}</p>)}<p className="recommend">추천 · {todayTasks[0]?.title??todayEvents[0]?.title??"오늘 목표를 시작할 첫 행동 하나를 정하세요."}</p></div></article></section><aside className="rightRail"><article className="premiumCard"><div className="cardTitle"><h2>▣ 오늘 일정</h2><button onClick={()=>setView("calendar")}>전체 보기</button></div><div className="compactList">{todayEvents.slice(0,5).map(e=>{const s=eventStatus(e);return <article key={e.id} onClick={()=>openEvent(e)}><time>{eventTime(e.start)}</time><div><strong>{e.title}</strong><small>{e.location||"장소 미입력"}</small></div><span className={s==="완료"?"done":s==="진행 중"?"doing":"planned"}>{s}</span></article>})}{!todayEvents.length&&<p>오늘 일정이 없습니다.</p>}</div></article><article className="premiumCard"><div className="cardTitle"><h2>⚠ 확인이 필요한 것</h2><button onClick={()=>setView("tasks")}>전체 보기</button></div><div className="attentionList">{todayTasks.slice(0,3).map(t=><article key={t.id}><b>□</b><div><strong>{t.title}</strong><small>{t.scheduledAt?new Date(t.scheduledAt).toLocaleString("ko-KR"):"오늘 할 일"}</small></div></article>)}{duePeople.slice(0,2).map(p=><article key={p.id}><b>●</b><div><strong>{p.name} 연락</strong><small>{p.note||p.tags.join(" · ")}</small></div></article>)}{!todayTasks.length&&!duePeople.length&&<p>확인할 항목이 없습니다.</p>}</div></article><article className="premiumCard"><div className="cardTitle"><h2>📁 진행 중인 프로젝트</h2><button onClick={()=>setView("projects")}>전체 보기</button></div>{activeProjects.slice(0,3).map(p=><div className="miniProject" key={p.id}><div><strong>{p.name}</strong><span>{progress(p)}%</span></div><i><b style={{width:`${progress(p)}%`}}/></i></div>)}</article></aside></div></>}


  {view==="day"&&(()=>{
 const now=Date.now();
 const sorted=[...dayEvents].sort((a,b)=>new Date(a.start).getTime()-new Date(b.start).getTime());
 const upcoming=sorted.find(e=>new Date(e.end).getTime()>now);
 const completed=sorted.filter(e=>new Date(e.end).getTime()<=now);
 const remainingTasks=dayTasks.filter(t=>!t.done);
 const primary=remainingTasks[0]?.title || dayReview?.goal || (dayDate===todayKey()?local.goal:"") || "";
 return <div className="dayWorkspace">
  <section className="dayHero premiumCard">
   <div className="dayHeroCopy">
    <span>{dayDate===todayKey()?"오늘의 흐름":"하루 기록"}</span>
    <h2>{dayDate===todayKey()?"오늘을 한눈에 봅니다.":`${dayDate}의 기록`}</h2>
    <p>{dayEvents.length}개 일정 · {remainingTasks.length}개 남은 할 일 · {dayActivities.length}개 활동 기록</p>
   </div>
   <div className="dayHistoryControls"><label className="dayDateControl"><span>날짜</span><input type="date" value={dayDate} onChange={e=>setDayDate(e.target.value)}/></label><button onClick={()=>{setDayDate(todayKey());setView("home")}}>오늘로 돌아가기</button></div>
  </section>

  <section className="dayPriority premiumCard">
   <div>
    <span>오늘 가장 중요한 것</span>
    <strong>{primary || "아직 정하지 않았습니다."}</strong>
   </div>
   {!primary&&<button onClick={()=>setView("home")}>오늘 목표 작성</button>}
  </section>

  <section className="dayMainGrid">
   <div className="dayLeftColumn">
    <article className="premiumCard dayCompactCard">
     <div className="dayCardHead"><div><span>아침</span><h3>오늘의 방향</h3></div><button onClick={()=>setView("home")}>수정</button></div>
     <div className="directionRows">
      <div><b>목표</b><p>{dayReview?.goal||local.goal||"오늘 목표를 작성해 주세요."}</p></div>
      <div><b>즐길 것</b><p>{dayReview?.enjoyment||local.enjoyment||"오늘 누리고 싶은 것을 적어 주세요."}</p></div>
     </div>
    </article>

    <article className="premiumCard dayCompactCard">
     <div className="dayCardHead"><div><span>실행</span><h3>오늘 할 일</h3></div><button onClick={()=>setView("tasks")}>전체 보기</button></div>
     <div className="dayList">
      {dayTasks.slice(0,6).map(t=><button className={`dayTaskRow ${t.done?"done":""}`} key={t.id} onClick={()=>setEditingTask({...t})}><i>{t.done?"✓":"□"}</i><span>{t.title}</span>{t.scheduledAt&&<time>{eventTime(t.scheduledAt)}</time>}</button>)}
      {!dayTasks.length&&<button className="dayEmptyAction" onClick={()=>setView("tasks")}>+ 오늘 할 일 추가</button>}
     </div>
    </article>

    <article className="premiumCard dayCompactCard">
     <div className="dayCardHead"><div><span>기록</span><h3>활동과 노트</h3></div></div>
     <div className="dayRecordSplit">
      <section><h4>활동</h4>{dayActivities.slice(0,3).map(a=><button className="dayRecordRow" key={a.id} onClick={()=>setEditingActivity({...a})}><span>{activityLabels[a.type]} · {a.title}</span><small>{a.duration}분</small></button>)}{!dayActivities.length&&<button className="dayEmptyAction" onClick={()=>setView("activities")}>+ 활동 기록</button>}</section>
      <section><h4>노트</h4>{dayNotes.slice(0,3).map(n=><button className="dayRecordRow" key={n.id} onClick={()=>setEditingNote({...n})}><span>{noteLabels[n.type]} · {n.title}</span></button>)}{!dayNotes.length&&<button className="dayEmptyAction" onClick={()=>setView("notes")}>+ 노트 남기기</button>}</section>
     </div>
    </article>
   </div>

   <div className="dayRightColumn">
    <article className="premiumCard dayScheduleCard">
     <div className="dayCardHead"><div><span>일정</span><h3>오늘의 시간</h3></div><button onClick={()=>setView("calendar")}>캘린더</button></div>
     {upcoming&&<div className="nextSchedule"><span>{new Date(upcoming.start).getTime()<=now?"진행 중":"다음 일정"}</span><strong>{upcoming.title}</strong><p>{eventTime(upcoming.start)}{upcoming.location?` · ${upcoming.location}`:""}</p></div>}
     <div className="scheduleTimeline">
      {sorted.slice(0,8).map(e=>{
       const end=new Date(e.end).getTime();
       const start=new Date(e.start).getTime();
       const state=end<=now?"past":start<=now?"current":"future";
       return <button className={`scheduleRow ${state}`} key={e.id} onClick={()=>openEvent(e)}><time>{eventTime(e.start)}</time><span>{e.title}</span><b>{state==="past"?"완료":state==="current"?"진행 중":"예정"}</b></button>
      })}
      {!sorted.length&&<button className="dayEmptyAction" onClick={()=>setView("calendar")}>+ 일정 추가</button>}
     </div>
    </article>

    <article className="premiumCard dayCompactCard reviewCard">
     <div className="dayCardHead"><div><span>저녁</span><h3>하루 리뷰</h3></div><button onClick={()=>{setReviewDate(dayDate);setView("review")}}>{dayReview?"열기":"작성"}</button></div>
     {dayReview?<div className="reviewPreview"><p><b>잘한 점</b>{dayReview.good||"—"}</p><p><b>배운 점</b>{dayReview.learned||"—"}</p><p><b>즐거웠던 순간</b>{dayReview.joy||"—"}</p></div>:<button className="dayEmptyAction" onClick={()=>{setReviewDate(dayDate);setView("review")}}>오늘을 돌아보고 기록하기</button>}
    </article>
   </div>
  </section>
 </div>
})()}

  {view==="calendar"&&<div className="calendarWorkspace"><section className="premiumCard calendarPage">
   <div className="calendarSourceBar"><span>표시할 캘린더</span><div>{calendarOptions.map(cal=><label key={cal.id} className={visibleCalendarIds.includes(cal.id)?"selected":""}><input type="checkbox" checked={visibleCalendarIds.includes(cal.id)} onChange={e=>setVisibleCalendarIds(ids=>e.target.checked?[...new Set([...ids,cal.id])]:ids.filter(x=>x!==cal.id))}/>{cal.name}</label>)}</div></div><div className="calendarToolbar">
    <div><button onClick={()=>{const n=new Date();setCursor(n);setSelectedDate(n)}}>오늘</button><button onClick={()=>{const d=new Date(cursor);calendarMode==="month"?d.setMonth(d.getMonth()-1):calendarMode==="week"?d.setDate(d.getDate()-7):d.setDate(d.getDate()-1);setCursor(d)}}>‹</button><button onClick={()=>{const d=new Date(cursor);calendarMode==="month"?d.setMonth(d.getMonth()+1):calendarMode==="week"?d.setDate(d.getDate()+7):d.setDate(d.getDate()+1);setCursor(d)}}>›</button><strong>{cursor.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:calendarMode==="day"?"numeric":undefined})}</strong></div>
    <div><button className={calendarMode==="month"?"active":""} onClick={()=>setCalendarMode("month")}>월</button><button className={calendarMode==="week"?"active":""} onClick={()=>setCalendarMode("week")}>주</button><button className={calendarMode==="day"?"active":""} onClick={()=>setCalendarMode("day")}>일</button><button className="goldBtn" onClick={()=>openNewEvent(selectedDate)}>+ 일정 추가</button></div>
   </div>
   {calendarError&&<p className="calendarError">{calendarError}</p>}
   {calendarMode==="month"&&<div className="monthCalendar"><div className="weekHeader">{["일","월","화","수","목","금","토"].map(x=><span key={x}>{x}</span>)}</div><div className="monthGrid">{monthDays(cursor).map(d=>{
    const key=todayKey(d);const de=events.filter(e=>eventDateKey(e.start)===key);
    return <button key={d.toISOString()} className={`${d.getMonth()!==cursor.getMonth()?"outside":""} ${key===selectedDateKey?"selected":""} ${key===todayKey()?"todayCell":""}`}
     onClick={()=>{setSelectedDate(d);setShowSelectedDay(true)}} onDoubleClick={()=>openNewEvent(d)}>
     <b>{d.getDate()}</b>{de.slice(0,2).map(e=><span key={e.id} title={`${eventTime(e.start)} ${e.title}`} onClick={ev=>{ev.stopPropagation();setSelectedDate(d);openEvent(e)}}>{eventTime(e.start)} {e.title}</span>)}{de.length>2&&<small>+{de.length-2}개</small>}
    </button>})}</div></div>}
   {calendarMode!=="month"&&<div className="agendaView">{events.sort((a,b)=>a.start.localeCompare(b.start)).map(e=><article key={e.id} onClick={()=>openEvent(e)}><time>{new Date(e.start).toLocaleDateString("ko-KR",{month:"short",day:"numeric",weekday:"short"})}<br/>{eventTime(e.start)}</time><div><strong>{e.title}</strong><small>{e.location||"장소 미입력"}</small></div><span>{eventStatus(e)}</span></article>)}</div>}
  </section>
  {showSelectedDay&&<aside className="premiumCard selectedDayPanel">
   <div className="selectedDayHead"><div><span>선택한 날짜</span><h2>{selectedDate.toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"long"})}</h2></div><button onClick={()=>openNewEvent(selectedDate)}>+ 일정</button></div>
   <div className="selectedDayList">{selectedDateEvents.map(e=><article key={e.id} onClick={()=>openEvent(e)}><time>{eventTime(e.start)}</time><div><strong>{e.title}</strong><small>{[e.location,e.hangoutLink?"Google Meet":""].filter(Boolean).join(" · ")||"세부 정보 없음"}</small></div><span>{eventStatus(e)}</span></article>)}{!selectedDateEvents.length&&<button className="emptyDayEvent" onClick={()=>openNewEvent(selectedDate)}>이 날짜에는 일정이 없습니다.<br/><b>새 일정 추가</b></button>}</div>
  </aside>}
 </div>}

  {view==="tasks"&&<><section className="premiumCard taskComposer"><input value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="할 일을 입력하세요"/><select value={taskBucket} onChange={e=>setTaskBucket(e.target.value as TaskBucket)}>{Object.entries(bucketLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><input type="datetime-local" value={taskWhen} onChange={e=>setTaskWhen(e.target.value)}/><input type="number" min="15" step="15" value={taskDuration} onChange={e=>setTaskDuration(Number(e.target.value))}/><select value={taskProject} onChange={e=>setTaskProject(e.target.value)}><option value="">프로젝트 없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><label><input type="checkbox" checked={taskSync} onChange={e=>setTaskSync(e.target.checked)}/> 캘린더에도 저장</label><button className="goldBtn" onClick={addTask}>추가</button></section><section className="premiumCard"><div className="taskTabs">{(Object.keys(bucketLabels) as TaskBucket[]).map(b=><button className={taskBucket===b?"active":""} onClick={()=>setTaskBucket(b)} key={b}>{bucketLabels[b]}</button>)}</div><div className="rows">{local.tasks.filter(t=>t.bucket===taskBucket).map(t=><article key={t.id}><input type="checkbox" checked={t.done} onChange={()=>update("tasks",local.tasks.map(x=>x.id===t.id?{...x,done:!x.done}:x))}/><div className={t.done?"lineDone":""}><strong>{t.title}</strong><small>{t.scheduledAt?new Date(t.scheduledAt).toLocaleString("ko-KR"):"날짜 없음"}{t.calendarEventId?" · Google Calendar":""}</small></div><button onClick={()=>setEditingTask({...t})}>수정</button><button onClick={()=>removeTask(t)}>삭제</button></article>)}</div></section></>}

  {view==="projects"&&<div className="projectWorkspace"><aside className="premiumCard projectList"><div className="cardTitle"><h2>프로젝트</h2><button onClick={()=>{const name=prompt("프로젝트 이름");if(name)update("projects",[...local.projects,{id:uid(),name,goal:"",next:"",status:"planning",milestones:[],note:""}])}}>＋</button></div>{local.projects.map(p=><button className={selectedProject===p.id?"active":""} onClick={()=>setSelectedProject(p.id)} key={p.id}><div><strong>{p.name}</strong><small>{p.status}</small></div><span>{progress(p)}%</span></button>)}</aside>{selectedProjectData&&<section className="premiumCard projectDetail"><div className="projectHero"><div><span>{selectedProjectData.status}</span><input className="projectNameInput" value={selectedProjectData.name} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,name:e.target.value}:p))}/><p>{selectedProjectData.goal||"프로젝트 목표를 입력하세요."}</p></div><b>{progress(selectedProjectData)}%</b></div><div className="projectFields"><label>목표<textarea value={selectedProjectData.goal} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,goal:e.target.value}:p))}/></label><label>다음 행동<textarea value={selectedProjectData.next} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,next:e.target.value}:p))}/></label><label>상태<select value={selectedProjectData.status} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,status:e.target.value as Project["status"]}:p))}><option value="planning">기획</option><option value="active">진행 중</option><option value="review">검토</option><option value="done">완료</option></select></label></div><div className="milestoneHead"><div><h3>중간 목표</h3><small>프로젝트를 완성하기 위해 거쳐야 하는 큰 단계입니다.</small></div><button onClick={()=>{const title=prompt("중간 목표 이름");if(!title)return;const w=Number(prompt("진행률 비중","25"))||25;update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:[...p.milestones,{id:uid(),title,done:false,weight:w}]}:p))}}>중간 목표 추가</button></div><div className="milestoneCards">{selectedProjectData.milestones.map(m=><label key={m.id}><input type="checkbox" checked={m.done} onChange={()=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.map(x=>x.id===m.id?{...x,done:!x.done}:x)}:p))}/><input className="milestoneTitleInput" value={m.title} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.map(x=>x.id===m.id?{...x,title:e.target.value}:x)}:p))}/><input className="milestoneWeightInput" type="number" value={m.weight} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.map(x=>x.id===m.id?{...x,weight:Number(e.target.value)}:x)}:p))}/><button onClick={()=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,milestones:p.milestones.filter(x=>x.id!==m.id)}:p))}>삭제</button></label>)}</div><div className="projectLinks"><h3>연결된 항목</h3><p>할 일 {local.tasks.filter(t=>t.projectId===selectedProjectData.id).length}개 · 활동 {local.activities.filter(a=>a.projectId===selectedProjectData.id).length}개 · 노트 {local.notes.filter(n=>n.projectId===selectedProjectData.id).length}개</p></div><label className="projectNote">프로젝트 메모<textarea value={selectedProjectData.note} onChange={e=>update("projects",local.projects.map(p=>p.id===selectedProjectData.id?{...p,note:e.target.value}:p))}/></label><button className="dangerBtn projectDeleteBtn" onClick={()=>{if(confirm("이 프로젝트를 삭제할까요?")){update("projects",local.projects.filter(p=>p.id!==selectedProjectData.id));setSelectedProject(local.projects.find(p=>p.id!==selectedProjectData.id)?.id??"")}}}>프로젝트 삭제</button></section>}</div>}

  {view==="people"&&<><section className="premiumCard peopleComposer"><input value={personName} onChange={e=>setPersonName(e.target.value)} placeholder="이름"/><input value={personTag} onChange={e=>setPersonTag(e.target.value)} placeholder="태그"/><button className="goldBtn" onClick={addPerson}>관계 추가</button></section><section className="peopleGrid">{local.people.map(p=><article className="premiumCard" key={p.id}><div className="personHead"><div className="avatar">{p.name.slice(0,1)}</div><div><h3>{p.name}</h3><span>{p.tags.join(" · ")}</span></div></div><label>최근 연락<input type="date" value={p.lastContact} onChange={e=>update("people",local.people.map(x=>x.id===p.id?{...x,lastContact:e.target.value}:x))}/></label><label>다음 연락<input type="date" value={p.nextContact} onChange={e=>update("people",local.people.map(x=>x.id===p.id?{...x,nextContact:e.target.value}:x))}/></label><label>메모<textarea value={p.note} onChange={e=>update("people",local.people.map(x=>x.id===p.id?{...x,note:e.target.value}:x))}/></label><div className="cardActions"><button onClick={()=>setEditingPerson({...p,logs:p.logs??[]})}>상세·수정</button><button onClick={()=>update("people",local.people.filter(x=>x.id!==p.id))}>삭제</button></div></article>)}</section></>}

  {view==="records"&&<div className="recordsWorkspace">
   <section className="premiumCard recordsHero">
    <div><span>기록</span><h2>활동·노트·리뷰를 한 흐름으로 봅니다.</h2><p>실행한 것, 떠오른 생각, 하루의 회고가 날짜 순서로 이어집니다.</p></div>
    <div className="recordQuickActions"><button onClick={()=>setView("activities")}>활동 기록</button><button onClick={()=>setView("notes")}>노트 작성</button><button onClick={()=>setView("review")}>리뷰 작성</button></div>
   </section>
   <section className="recordSummaryGrid">
    <article className="premiumCard"><div><strong>{local.activities.length}</strong><span>활동 기록</span></div><button onClick={()=>setView("activities")}>열기</button></article>
    <article className="premiumCard"><div><strong>{local.notes.length}</strong><span>노트</span></div><button onClick={()=>setView("notes")}>열기</button></article>
    <article className="premiumCard"><div><strong>{Object.keys(local.reviews).length}</strong><span>리뷰</span></div><button onClick={()=>setView("review")}>열기</button></article>
   </section>
   <section className="premiumCard recordsTimelineCard">
    <div className="cardTitle"><div><h2>최근 기록</h2><small>활동·노트·리뷰·완료 업무를 날짜순으로 표시합니다.</small></div><button onClick={()=>setView("timeline")}>전체 보기</button></div>
    <div className="timeline">
     {timelineItems.slice(0,20).map((item,index)=><article key={`${item.date}-${index}`}><time>{item.date}</time><div><span>{item.kind}</span><strong>{item.title}</strong>{item.note&&<p>{item.note}</p>}</div></article>)}
     {!timelineItems.length&&<p className="empty">아직 기록이 없습니다.</p>}
    </div>
   </section>
  </div>}

  {view==="activities"&&<><section className="premiumCard activityComposer">
<label><span>활동 종류</span><select value={activityType} onChange={e=>setActivityType(e.target.value as ActivityType)}>{Object.entries(activityLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
<label><span>날짜</span><input type="date" value={activityDate} onChange={e=>setActivityDate(e.target.value)}/></label>
<label className="activityTitleField"><span>{activityType==="reading"?"책 이름":activityType==="running"?"훈련 이름":"활동 이름"}</span><input value={activityTitle} onChange={e=>setActivityTitle(e.target.value)} placeholder={activityType==="other"?"원하는 활동 이름을 직접 입력":activityType==="reading"?"예: 설득의 심리학":activityType==="running"?"예: 10km 조깅":"예: 하체 운동"}/></label>
<label><span>활동 시간</span><div className="unitInput"><input type="number" min="0" value={activityDuration} onChange={e=>setActivityDuration(Number(e.target.value))}/><b>분</b></div></label>
<label><span>{activityType==="running"?"거리":activityType==="reading"?"읽은 분량":activityType==="workout"?"운동량":"수치(선택)"}</span><div className="unitInput"><input type="number" min="0" step="0.1" value={activityAmount} onChange={e=>setActivityAmount(Number(e.target.value))}/><b>{activityType==="running"?"km":activityType==="reading"?"쪽":activityType==="workout"?"세트":activityType==="study"?"회":""}</b></div></label>
<label className="wideField"><span>기록과 느낌</span><textarea value={activityNote} onChange={e=>setActivityNote(e.target.value)} placeholder="몸 상태, 내용, 느낀 점"/></label>
<label className="wideField"><span>배운 것</span><textarea value={activityLearned} onChange={e=>setActivityLearned(e.target.value)} placeholder="새롭게 알게 된 것"/></label>
<label className="wideField"><span>적용할 것</span><textarea value={activityApplied} onChange={e=>setActivityApplied(e.target.value)} placeholder="다음에 실제로 적용할 것"/></label>
<label><span>연결 프로젝트</span><select value={activityProject} onChange={e=>setActivityProject(e.target.value)}><option value="">없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="goldBtn activitySaveBtn" onClick={addActivity}>기록 저장</button>
</section><section className="activityCards">{[...local.activities].sort((a,b)=>b.date.localeCompare(a.date)).map(a=><article className="premiumCard" key={a.id}><div className="activityHead"><span>{activityLabels[a.type]}</span><time>{a.date}</time></div><h3>{a.title}</h3><p><b>{a.duration}분</b>{a.amount?` · ${a.amount}${a.unit==="page"?"쪽":a.unit}`:""}</p>{a.note&&<small>{a.note}</small>}{a.learned&&<small>배운 것 · {a.learned}</small>}{a.applied&&<small>적용 · {a.applied}</small>}<div className="cardActions"><button onClick={()=>setEditingActivity({...a})}>수정</button><button onClick={()=>update("activities",local.activities.filter(x=>x.id!==a.id))}>삭제</button></div></article>)}</section></>}

  {view==="notes"&&<><section className="premiumCard noteComposer"><select value={noteType} onChange={e=>setNoteType(e.target.value as NoteType)}>{Object.entries(noteLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><input value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} placeholder="제목"/><textarea value={noteBody} onChange={e=>setNoteBody(e.target.value)} placeholder="기록할 내용을 적으세요"/><select value={noteProject} onChange={e=>setNoteProject(e.target.value)}><option value="">프로젝트 없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="goldBtn" onClick={addNote}>저장</button></section><section className="noteGrid">{[...local.notes].reverse().map(n=><article className="premiumCard" key={n.id}><span>{noteLabels[n.type]} · {n.date}</span><h3>{n.title}</h3><p>{n.body}</p><div className="cardActions"><button onClick={()=>setEditingNote({...n})}>수정</button><button onClick={()=>update("notes",local.notes.filter(x=>x.id!==n.id))}>삭제</button></div></article>)}</section></>}

  {view==="review"&&<div className="reviewWorkspace"><aside className="premiumCard reviewHistory"><input type="date" value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/>{reviewDates.map(d=><button className={d===reviewDate?"active":""} onClick={()=>setReviewDate(d)} key={d}>{new Date(`${d}T00:00`).toLocaleDateString("ko-KR",{month:"short",day:"numeric",weekday:"short"})}</button>)}</aside><section className="premiumCard reviewForm"><div className="reviewSummary"><label>그날 목표<input value={currentReview.goal} onChange={e=>updateReview({goal:e.target.value})}/></label><label>그날 즐길 것<input value={currentReview.enjoyment} onChange={e=>updateReview({enjoyment:e.target.value})}/></label></div><div className="reviewSummary"><label>목표 결과<select value={currentReview.status} onChange={e=>updateReview({status:e.target.value as Review["status"]})}><option value="">선택</option><option value="done">완료</option><option value="not_done">미완료</option><option value="changed">우선순위 변경</option></select></label><label>이유<input value={currentReview.reason} onChange={e=>updateReview({reason:e.target.value})}/></label></div><div className="reviewGrid"><label>잘한 점<textarea value={currentReview.good} onChange={e=>updateReview({good:e.target.value})}/></label><label>배운 점<textarea value={currentReview.learned} onChange={e=>updateReview({learned:e.target.value})}/></label><label>즐거웠던 순간<textarea value={currentReview.joy} onChange={e=>updateReview({joy:e.target.value})}/></label><label>감사 3가지<textarea value={currentReview.gratitude} onChange={e=>updateReview({gratitude:e.target.value})}/></label></div></section></div>}

  {view==="timeline"&&<section className="premiumCard timelineList">{timeline.map((x,i)=><article key={`${x.date}-${i}`}><time>{x.date}</time><i/><div><span>{x.kind}</span><h3>{x.title}</h3>{x.note&&<p>{x.note}</p>}</div></article>)}</section>}

  {view==="analytics"&&<><section className="statGrid"><article className="premiumCard"><strong>{monthActivities.length}</strong><span>이번 달 활동 기록</span></article><article className="premiumCard"><strong>{local.tasks.filter(t=>t.done).length}</strong><span>완료한 할 일</span></article><article className="premiumCard"><strong>{Object.values(local.reviews).filter(r=>r.status==="done").length}</strong><span>완료한 하루 목표</span></article><article className="premiumCard"><strong>{local.notes.length}</strong><span>나의 노트</span></article></section>
<section className="premiumCard dashboardSection"><div className="cardTitle"><div><h2>이번 달 흐름</h2><small>세부 기록은 활동 기록에서 추가·수정합니다.</small></div><button onClick={()=>setView("activities")}>활동 기록 열기</button></div>
<div className="activityStats grouped">
{[
 {key:"exercise",label:"운동",types:["running","workout","martial"] as ActivityType[]},
 {key:"reading",label:"독서",types:["reading"] as ActivityType[]},
 {key:"study",label:"공부",types:["study"] as ActivityType[]},
 {key:"life",label:"생활·기타",types:["church","photo","other"] as ActivityType[]}
].map(group=>{const list=monthActivities.filter(a=>group.types.includes(a.type));return <article key={group.key} onClick={()=>setView("activities")}><strong>{group.label}</strong><b>{list.length}회</b><small>{Math.round(list.reduce((s,a)=>s+a.duration,0)/6)/10}시간</small></article>})}
</div></section>
<section className="premiumCard dashboardSection"><div className="cardTitle"><div><h2>프로젝트 진행률</h2><small>진행률은 프로젝트의 중간 목표 완료 상태로 계산됩니다.</small></div><button onClick={()=>setView("projects")}>프로젝트 관리</button></div>{local.projects.map(p=><div className="miniProject clickableProject" key={p.id} onClick={()=>{setSelectedProject(p.id);setView("projects")}}><div><strong>{p.name}</strong><span>{progress(p)}%</span></div><i><b style={{width:`${progress(p)}%`}}/></i></div>)}</section></>}

  {view==="chapters"&&<><section className="premiumCard chapterComposer"><label><span>새 시기 이름</span><input value={chapterTitle} onChange={e=>setChapterTitle(e.target.value)} placeholder="예: JEONG를 완성하는 시기"/></label><label><span>이 시기의 의미</span><input value={chapterDescription} onChange={e=>setChapterDescription(e.target.value)} placeholder="무엇을 만들고 살아갈 시기인가"/></label><button className="goldBtn" onClick={addChapter}>새 시기 시작</button></section><section className="chapterGrid">{[...local.chapters].reverse().map(c=><article className={`premiumCard ${c.active?"active":""}`} key={c.id}><div className="chapterContent"><span>{c.active?"현재 시기":"지난 시기"}</span><h3>{c.title}</h3><p>{c.description}</p><small>{c.startDate}{c.endDate?` — ${c.endDate}`:" — 진행 중"}</small></div>{c.active&&<button className="chapterEndBtn" onClick={()=>update("chapters",local.chapters.map(x=>x.id===c.id?{...x,active:false,endDate:todayKey()}:x))}>현재 시기 종료</button>}</article>)}</section></>}


  {view==="ai"&&<><section className="premiumCard aiBridgeHero"><div><span>추가 API 비용 없음</span><h2>외부 AI 연결</h2><p>JEONG가 필요한 데이터를 정리하고, ChatGPT에 붙여넣을 프롬프트를 만듭니다. 자동 전송하지 않으며 열기 전에 내용을 확인하고 수정할 수 있습니다.</p></div><button className="goldBtn" onClick={()=>prepareAi("daily")}>현재 데이터 불러오기</button></section><section className="premiumCard aiBridgePanel"><div className="aiTypeGrid"><button className={aiType==="morning"?"active":""} onClick={()=>prepareAi("morning")}><strong>아침 브리핑</strong><span>오늘 일정·할 일·준비</span></button><button className={aiType==="daily"?"active":""} onClick={()=>prepareAi("daily")}><strong>오늘 점검</strong><span>완료·남은 일·다음 행동</span></button><button className={aiType==="weekly"?"active":""} onClick={()=>prepareAi("weekly")}><strong>주간 점검</strong><span>프로젝트와 이번 주 흐름</span></button><button className={aiType==="project"?"active":""} onClick={()=>prepareAi("project")}><strong>프로젝트 상담</strong><span>막힌 지점과 다음 행동</span></button><button className={aiType==="free"?"active":""} onClick={()=>prepareAi("free")}><strong>자유 대화</strong><span>JEONG 자료를 대화 배경으로</span></button></div><label className="aiPrivacyCheck"><input type="checkbox" checked={aiIncludePeople} onChange={e=>{setAiIncludePeople(e.target.checked);setTimeout(()=>setAiPrompt(buildAiPrompt(aiType)),0)}}/><span>연락 예정인 사람의 이름·태그도 포함</span></label><label className="aiPreview"><span>전송 전 미리보기·수정</span><textarea value={aiPrompt} onChange={e=>{setAiPrompt(e.target.value);setAiCopied(false)}} placeholder="분석 유형을 선택하면 JEONG 데이터가 여기에 정리됩니다."/></label><div className="aiActions"><button onClick={copyAiPrompt}>{aiCopied?"복사 완료":"프롬프트 복사"}</button><button className="goldBtn" onClick={openChatGPT}>복사하고 외부 AI 열기</button></div><p className="aiHint">외부 AI가 열리면 입력창에 붙여넣기(Ctrl+V) 후 전송하세요. JEONG의 데이터는 이 버튼을 누르기 전까지 외부로 전송되지 않습니다.</p></section></>}

  {view==="settings"&&<><section className="premiumCard advancedAccessPanel"><div className="cardTitle"><div><h2>고급 기능</h2><small>기본 메뉴에서는 숨기고, 필요한 사용자만 엽니다.</small></div></div><div className="advancedAccessButtons"><button onClick={()=>setView("timeline")}>전체 타임라인</button><button onClick={()=>setView("chapters")}>삶의 시기</button></div></section><section className="premiumCard settingsPanel"><h2>설정</h2><div><span>테마</span><button onClick={toggleTheme}>{theme==="light"?"다크 모드":"라이트 모드"}</button></div><div><span>Google 데이터</span><button onClick={loadCalendar}>{loading?"불러오는 중":"새로고침"}</button></div><div><span>백업 복원</span><label className="importBtn">파일 선택<input type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)importBackup(f)}}/></label></div><div><span>로컬 데이터 백업</span><button onClick={()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(local,null,2)],{type:"application/json"}));a.download=`JEONG-${todayKey()}.json`;a.click()}}>내보내기</button></div></section>
<section className="premiumCard aiEngineSettings">
 <div className="cardTitle"><div><h2>AI 엔진</h2><small>JEONG의 화면과 기억은 유지하고, 필요한 AI 두뇌만 선택합니다.</small></div></div>
 <div className="aiEnginePicker">
  <label>사용할 엔진<select value={aiEngine} onChange={e=>{setAiEngine(e.target.value as AiEngine);setAiStatus("")}}><option value="none">연결 안 함</option><option value="ollama">Ollama · 무료 로컬 AI</option><option value="openai">OpenAI API</option><option value="claude">Claude API</option><option value="gemini">Gemini API</option></select></label>
  {aiEngine==="ollama"&&<label>로컬 모델<input value={aiModel} onChange={e=>setAiModel(e.target.value)} placeholder="예: llama3.2:3b"/></label>}
 </div>
 <article className="aiSetupGuide">
  <div className="aiGuideHeader"><div><span>연결 안내</span><h3>{currentAiGuide.title}</h3></div><b>{currentAiGuide.cost}</b></div>
  <ol>{currentAiGuide.steps.map((step,index)=><li key={index}><i>{index+1}</i><span>{step}</span></li>)}</ol>
  {currentAiGuide.env&&<div className="envExample"><span>.env.local에 입력</span><code>{currentAiGuide.env}</code><button onClick={()=>navigator.clipboard.writeText(currentAiGuide.env!)}>복사</button></div>}
  <p>{currentAiGuide.note}</p>
  {currentAiGuide.link&&<button className="officialLinkBtn" onClick={()=>window.open(currentAiGuide.link,"_blank","noopener,noreferrer")}>{currentAiGuide.linkLabel} ↗</button>}
 </article>
 <div className="aiSetupActions"><button className="goldBtn" onClick={testAiEngine}>설정 저장·연결 확인</button>{aiStatus&&<strong className="aiStatus">{aiStatus}</strong>}</div>
</section></>}
  </main>

  {editingTask&&<div className="overlay"><div className="editModal"><div className="modalHead"><h2>할 일 수정</h2><button onClick={()=>setEditingTask(null)}>닫기</button></div><label>할 일<input value={editingTask.title} onChange={e=>setEditingTask({...editingTask,title:e.target.value})}/></label><div className="twoFields"><label>기간<select value={editingTask.bucket} onChange={e=>setEditingTask({...editingTask,bucket:e.target.value as TaskBucket})}>{Object.entries(bucketLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>프로젝트<select value={editingTask.projectId??""} onChange={e=>setEditingTask({...editingTask,projectId:e.target.value||undefined})}><option value="">없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><div className="twoFields"><label>날짜·시간<input type="datetime-local" value={editingTask.scheduledAt} onChange={e=>setEditingTask({...editingTask,scheduledAt:e.target.value})}/></label><label>예상 시간(분)<input type="number" value={editingTask.durationMinutes} onChange={e=>setEditingTask({...editingTask,durationMinutes:Number(e.target.value)})}/></label></div><label className="checkRow"><input type="checkbox" checked={editingTask.syncCalendar} onChange={e=>setEditingTask({...editingTask,syncCalendar:e.target.checked})}/>Google Calendar와 연결</label><button className="goldBtn" onClick={saveTaskEdit}>저장</button></div></div>}
  {editingActivity&&<div className="overlay"><div className="editModal"><div className="modalHead"><h2>활동 기록 수정</h2><button onClick={()=>setEditingActivity(null)}>닫기</button></div><div className="twoFields"><label>종류<select value={editingActivity.type} onChange={e=>setEditingActivity({...editingActivity,type:e.target.value as ActivityType})}>{Object.entries(activityLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>날짜<input type="date" value={editingActivity.date} onChange={e=>setEditingActivity({...editingActivity,date:e.target.value})}/></label></div><label>제목<input value={editingActivity.title} onChange={e=>setEditingActivity({...editingActivity,title:e.target.value})}/></label><div className="twoFields"><label>시간(분)<input type="number" value={editingActivity.duration} onChange={e=>setEditingActivity({...editingActivity,duration:Number(e.target.value)})}/></label><label>수치<input type="number" step="0.1" value={editingActivity.amount} onChange={e=>setEditingActivity({...editingActivity,amount:Number(e.target.value)})}/></label></div><label>프로젝트<select value={editingActivity.projectId??""} onChange={e=>setEditingActivity({...editingActivity,projectId:e.target.value||undefined})}><option value="">없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>기록<textarea value={editingActivity.note} onChange={e=>setEditingActivity({...editingActivity,note:e.target.value})}/></label><label>배운 것<textarea value={editingActivity.learned} onChange={e=>setEditingActivity({...editingActivity,learned:e.target.value})}/></label><label>적용할 것<textarea value={editingActivity.applied} onChange={e=>setEditingActivity({...editingActivity,applied:e.target.value})}/></label><button className="goldBtn" onClick={saveActivityEdit}>저장</button></div></div>}
  {editingNote&&<div className="overlay"><div className="editModal"><div className="modalHead"><h2>노트 수정</h2><button onClick={()=>setEditingNote(null)}>닫기</button></div><div className="twoFields"><label>분류<select value={editingNote.type} onChange={e=>setEditingNote({...editingNote,type:e.target.value as NoteType})}>{Object.entries(noteLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>날짜<input type="date" value={editingNote.date} onChange={e=>setEditingNote({...editingNote,date:e.target.value})}/></label></div><label>제목<input value={editingNote.title} onChange={e=>setEditingNote({...editingNote,title:e.target.value})}/></label><label>프로젝트<select value={editingNote.projectId??""} onChange={e=>setEditingNote({...editingNote,projectId:e.target.value||undefined})}><option value="">없음</option>{local.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>내용<textarea value={editingNote.body} onChange={e=>setEditingNote({...editingNote,body:e.target.value})}/></label><button className="goldBtn" onClick={saveNoteEdit}>저장</button></div></div>}
  {editingPerson&&<div className="overlay"><div className="editModal personModal"><div className="modalHead"><h2>관계 상세</h2><button onClick={()=>setEditingPerson(null)}>닫기</button></div><div className="twoFields"><label>이름<input value={editingPerson.name} onChange={e=>setEditingPerson({...editingPerson,name:e.target.value})}/></label><label>태그<input value={editingPerson.tags.join(", ")} onChange={e=>setEditingPerson({...editingPerson,tags:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label></div><div className="twoFields"><label>전화<input value={editingPerson.phone??""} onChange={e=>setEditingPerson({...editingPerson,phone:e.target.value})}/></label><label>이메일<input value={editingPerson.email??""} onChange={e=>setEditingPerson({...editingPerson,email:e.target.value})}/></label></div><div className="twoFields"><label>최근 연락<input type="date" value={editingPerson.lastContact} onChange={e=>setEditingPerson({...editingPerson,lastContact:e.target.value})}/></label><label>다음 연락<input type="date" value={editingPerson.nextContact} onChange={e=>setEditingPerson({...editingPerson,nextContact:e.target.value})}/></label></div><label>관계 메모<textarea value={editingPerson.note} onChange={e=>setEditingPerson({...editingPerson,note:e.target.value})}/></label><section className="contactLogBox"><h3>연락 기록</h3><div className="contactLogComposer"><select value={contactChannel} onChange={e=>setContactChannel(e.target.value)}><option>문자</option><option>전화</option><option>카카오톡</option><option>이메일</option><option>대면</option></select><input value={contactSummary} onChange={e=>setContactSummary(e.target.value)} placeholder="무슨 이야기를 했는지"/><button onClick={addContactLog}>기록</button></div>{[...(editingPerson.logs??[])].reverse().map(log=><article key={log.id}><time>{log.date}</time><b>{log.channel}</b><span>{log.summary}</span></article>)}</section><button className="goldBtn" onClick={savePersonEdit}>저장</button></div></div>}

  {eventForm&&<div className="overlay"><form className="eventModal advancedEventModal" onSubmit={saveEvent}>
 <div className="modalHead"><div><span>Google Calendar</span><h2>{eventForm.id?"일정 수정":"일정 추가"}</h2></div><button type="button" onClick={()=>setEventForm(null)}>닫기</button></div>
 <label>제목<input required autoFocus value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})}/></label>
 <label className="checkRow"><input type="checkbox" checked={eventForm.allDay} onChange={e=>setEventForm({...eventForm,allDay:e.target.checked,start:e.target.checked?dateInput(eventForm.start):toLocalInput(`${eventForm.start}T09:00:00`),end:e.target.checked?dateInput(eventForm.end):toLocalInput(`${eventForm.end}T10:00:00`)})}/>종일 일정</label>
 <div className="twoFields"><label>시작<input type={eventForm.allDay?"date":"datetime-local"} value={eventForm.start} onChange={e=>setEventForm({...eventForm,start:e.target.value})}/></label><label>종료<input type={eventForm.allDay?"date":"datetime-local"} value={eventForm.end} onChange={e=>setEventForm({...eventForm,end:e.target.value})}/></label></div>
 <section className="eventOptionSection recurrenceSection">
 <h3>반복 일정</h3>
 <div className="recurrenceTopGrid">
  <label>반복 방식<select value={eventForm.recurrence} onChange={e=>setEventForm({...eventForm,recurrence:e.target.value as Recurrence})}><option value="none">반복 안 함</option><option value="daily">매일</option><option value="weekdays">평일마다</option><option value="weekly">매주</option><option value="biweekly">격주</option><option value="monthly">매월</option><option value="yearly">매년</option><option value="custom">사용자 지정</option></select></label>
  <label>반복 간격<div className="intervalInput"><span>매</span><input type="number" min="1" max="52" value={eventForm.recurrenceInterval} onChange={e=>setEventForm({...eventForm,recurrenceInterval:Math.max(1,Number(e.target.value))})}/><b>{eventForm.recurrence==="yearly"?"년":eventForm.recurrence==="monthly"?"개월":eventForm.recurrence==="daily"?"일":"주"}마다</b></div></label>
 </div>
 {(eventForm.recurrence==="weekly"||eventForm.recurrence==="biweekly"||eventForm.recurrence==="custom")&&<div className="weekdayQuickPicks"><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["MO","TU","WE","TH","FR"]})}>평일</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["SA","SU"]})}>주말</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["MO","WE","FR"]})}>월·수·금</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["TU","TH"]})}>화·목</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:["MO","TU","WE","TH","FR","SA","SU"]})}>매일</button><button type="button" onClick={()=>setEventForm({...eventForm,weeklyDays:[]})}>전체 해제</button></div>}{(eventForm.recurrence==="weekly"||eventForm.recurrence==="biweekly"||eventForm.recurrence==="custom")&&<div className="weekdayBlock"><span>반복할 요일</span><div className="weekdayPicker">{[["MO","월"],["TU","화"],["WE","수"],["TH","목"],["FR","금"],["SA","토"],["SU","일"]].map(([v,l])=><label key={v} className={eventForm.weeklyDays.includes(v)?"selected":""}><input type="checkbox" checked={eventForm.weeklyDays.includes(v)} onChange={e=>setEventForm({...eventForm,weeklyDays:e.target.checked?[...eventForm.weeklyDays,v]:eventForm.weeklyDays.filter(x=>x!==v)})}/>{l}</label>)}</div></div>}
 {eventForm.recurrence==="monthly"&&<label className="monthlyModeLabel">매월 반복 방식<select value={eventForm.monthlyMode} onChange={e=>setEventForm({...eventForm,monthlyMode:e.target.value as EventForm["monthlyMode"]})}><option value="date">같은 날짜</option><option value="lastDay">매월 마지막 날</option><option value="nthWeekday">같은 주차·요일</option><option value="lastWeekday">매월 마지막 같은 요일</option></select></label>}{eventForm.recurrence!=="none"&&<div className="recurrenceEndGrid">
  <label>반복 종료 방식<select value={eventForm.recurrenceCount>0?"count":eventForm.recurrenceUntil?"until":"never"} onChange={e=>{const v=e.target.value;setEventForm({...eventForm,recurrenceCount:v==="count"?Math.max(1,eventForm.recurrenceCount||1):0,recurrenceUntil:v==="until"?(eventForm.recurrenceUntil||eventForm.start.slice(0,10)):""})}}><option value="never">종료일 없음</option><option value="until">날짜까지</option><option value="count">횟수만큼</option></select></label>
  {eventForm.recurrenceUntil&&<label>종료일<input type="date" value={eventForm.recurrenceUntil} onChange={e=>setEventForm({...eventForm,recurrenceUntil:e.target.value,recurrenceCount:0})}/></label>}
  {eventForm.recurrenceCount>0&&<label>총 반복 횟수<input type="number" min="1" value={eventForm.recurrenceCount} onChange={e=>setEventForm({...eventForm,recurrenceCount:Math.max(1,Number(e.target.value)),recurrenceUntil:""})}/></label>}
 </div>}
 {eventForm.recurrence!=="none"&&<div className="exceptionOptions">
  <label><input type="checkbox" checked={eventForm.excludeWeekends} onChange={e=>setEventForm({...eventForm,excludeWeekends:e.target.checked})}/>토요일·일요일 제외</label>
  <label><input type="checkbox" checked={eventForm.excludeHolidays} onChange={e=>setEventForm({...eventForm,excludeHolidays:e.target.checked})}/>대한민국 공휴일 처리</label>{eventForm.excludeHolidays&&<select value={eventForm.holidayPolicy} onChange={e=>setEventForm({...eventForm,holidayPolicy:e.target.value as EventForm["holidayPolicy"]})}><option value="skip">건너뛰기</option><option value="next">다음 평일로 이동</option><option value="previous">이전 평일로 이동</option></select>}
 </div>}
 {eventForm.recurrence!=="none"&&(eventForm.excludeHolidays||eventForm.excludeWeekends)&&<p className="optionHint">제외 날짜는 Google Calendar 반복 예외일로 저장됩니다. 종료일이 없으면 우선 1년 범위에서 적용합니다.</p>}
 {eventForm.seriesId&&<label>수정 범위<select value={eventForm.editScope} onChange={e=>setEventForm({...eventForm,editScope:e.target.value as "single"|"series"})}><option value="single">이 일정만</option><option value="future">이 일정과 이후 일정</option><option value="series">반복 일정 전체</option></select></label>}
</section>
 <section className="eventOptionSection"><div className="sectionTitleRow"><h3>알림</h3><button type="button" onClick={()=>setEventForm({...eventForm,reminders:[...eventForm.reminders,30]})}>+ 알림 추가</button></div><div className="reminderList">{eventForm.reminders.map((r,i)=><div key={i}><select value={r} onChange={e=>setEventForm({...eventForm,reminders:eventForm.reminders.map((x,j)=>j===i?Number(e.target.value):x)})}><option value="0">정시</option><option value="5">5분 전</option><option value="10">10분 전</option><option value="30">30분 전</option><option value="60">1시간 전</option><option value="120">2시간 전</option><option value="1440">1일 전</option><option value="2880">2일 전</option><option value="10080">1주 전</option></select><span>{reminderLabel(r)}</span><button type="button" onClick={()=>setEventForm({...eventForm,reminders:eventForm.reminders.filter((_,j)=>j!==i)})}>삭제</button></div>)}</div><p className="optionHint">Google Calendar 앱·웹 설정에 따라 휴대폰과 PC로 알림이 옵니다.</p></section>
 <section className="eventOptionSection"><h3>사람과 회의</h3><label>참석자 이메일<input value={eventForm.attendees} onChange={e=>setEventForm({...eventForm,attendees:e.target.value})} placeholder="쉼표로 구분"/></label><label className="checkRow"><input type="checkbox" checked={eventForm.addMeet} onChange={e=>setEventForm({...eventForm,addMeet:e.target.checked})}/>Google Meet 링크 만들기</label></section>
 <label>저장할 캘린더<select value={eventForm.calendarId} onChange={e=>setEventForm({...eventForm,calendarId:e.target.value})}>{calendarOptions.map(cal=><option key={cal.id} value={cal.id}>{cal.name}</option>)}</select></label><div className="twoFields"><label>장소<input value={eventForm.location} onChange={e=>setEventForm({...eventForm,location:e.target.value})}/></label><label>색상<select value={eventForm.colorId} onChange={e=>setEventForm({...eventForm,colorId:e.target.value})}>{Object.entries(colorLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
 <label>메모<textarea value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></label>
 <div className="twoFields"><label>공개 범위<select value={eventForm.visibility} onChange={e=>setEventForm({...eventForm,visibility:e.target.value as EventForm["visibility"]})}><option value="default">캘린더 기본값</option><option value="public">공개</option><option value="private">비공개</option></select></label><label>내 시간 표시<select value={eventForm.transparency} onChange={e=>setEventForm({...eventForm,transparency:e.target.value as EventForm["transparency"]})}><option value="opaque">바쁨</option><option value="transparent">한가함</option></select></label></div>
 <div className="modalActions eventModalActions">
  {eventForm.id&&<div className="deleteActionGroup">
   {eventForm.seriesId?<><button type="button" className="dangerBtn" onClick={()=>deleteEvent("single")}>이 일정만 삭제</button><button type="button" className="dangerOutlineBtn" onClick={()=>deleteEvent("future")}>이 일정과 이후 삭제</button><button type="button" className="dangerOutlineBtn" onClick={()=>deleteEvent("series")}>반복 전체 삭제</button></>:<button type="button" className="dangerBtn" onClick={()=>deleteEvent("single")}>일정 삭제</button>}
   {events.find(x=>x.id===eventForm.id)?.htmlLink&&<button type="button" onClick={()=>window.open(events.find(x=>x.id===eventForm.id)?.htmlLink,"_blank")}>Google에서 열기</button>}
  </div>}
  <button className="goldBtn">Google Calendar에 저장</button>
 </div>
 </form></div>}
 </div>
}
