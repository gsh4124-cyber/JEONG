import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const ROOT="https://www.googleapis.com/calendar/v3/calendars";
async function token(){return (await auth())?.accessToken}
const cal=(id:string)=>`${ROOT}/${encodeURIComponent(id||"primary")}/events`;

function ymdAdd(value:string,days:number){
 const [y,m,d]=value.slice(0,10).split("-").map(Number);
 const date=new Date(Date.UTC(y,m-1,d));date.setUTCDate(date.getUTCDate()+days);
 return date.toISOString().slice(0,10);
}
function map(item:any,calendarId="primary",calendarName=""){
 const allDay=!!item.start?.date;
 const rawEnd=item.end?.dateTime??item.end?.date??"";
 return {
  id:item.id,title:item.summary??"제목 없는 일정",
  start:item.start?.dateTime??item.start?.date,
  end:allDay&&rawEnd?ymdAdd(rawEnd,-1):rawEnd,
  allDay,location:item.location??"",description:item.description??"",
  recurrence:item.recurrence??[],
  reminders:(item.reminders?.overrides??[]).map((x:any)=>Number(x.minutes)).filter((x:number)=>Number.isFinite(x)),
  htmlLink:item.htmlLink??"",hangoutLink:item.hangoutLink??"",
  attendees:(item.attendees??[]).map((x:any)=>x.email).filter(Boolean),
  colorId:item.colorId??"",visibility:item.visibility??"default",
  transparency:item.transparency??"opaque",recurringEventId:item.recurringEventId??"",
  originalStart:item.originalStartTime?.dateTime??item.originalStartTime?.date??"",
  calendarId,calendarName
 }
}
function payload(body:any){
 const reminders=(Array.isArray(body.reminders)?body.reminders:[])
  .map((minutes:any)=>({method:"popup",minutes:Number(minutes)}))
  .filter((x:any)=>Number.isFinite(x.minutes)&&x.minutes>=0);
 const startDate=String(body.start).slice(0,10);
 const endDate=String(body.end).slice(0,10);
 const data:any={
  summary:body.title,location:body.location||undefined,description:body.description||undefined,
  start:body.allDay?{date:startDate}:{dateTime:body.start,timeZone:"Asia/Seoul"},
  end:body.allDay?{date:ymdAdd(endDate,1)}:{dateTime:body.end,timeZone:"Asia/Seoul"},
  recurrence:Array.isArray(body.recurrence)&&body.recurrence.length?body.recurrence:undefined,
  reminders:{useDefault:reminders.length===0,overrides:reminders.length?reminders:undefined},
  attendees:(Array.isArray(body.attendees)?body.attendees:[]).map((email:string)=>({email})),
  colorId:body.colorId||undefined,visibility:body.visibility||"default",
  transparency:body.transparency||"opaque"
 };
 if(body.addMeet&&!body.id)data.conferenceData={createRequest:{requestId:`jeong-${Date.now()}-${Math.random().toString(36).slice(2)}`,conferenceSolutionKey:{type:"hangoutsMeet"}}};
 return data;
}
function requestUrl(base:string){const u=new URL(base);u.searchParams.set("conferenceDataVersion","1");u.searchParams.set("sendUpdates","all");return u.toString()}
function untilBefore(value:string,allDay:boolean){
 if(allDay){const d=ymdAdd(value.slice(0,10),-1).replaceAll("-","");return `${d}T235959Z`}
 const d=new Date(value);d.setSeconds(d.getSeconds()-1);return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
}
function trimRule(lines:string[],until:string){
 const clean=lines.filter((x:string)=>!x.startsWith("EXDATE")&&!x.startsWith("RDATE"));
 const idx=clean.findIndex((x:string)=>x.startsWith("RRULE:"));
 if(idx<0)return clean;
 const parts=clean[idx].split(";").filter((x:string)=>!x.startsWith("UNTIL=")&&!x.startsWith("COUNT="));
 parts.push(`UNTIL=${until}`);clean[idx]=parts.join(";");return clean;
}
async function getEvent(access:string,calendarId:string,id:string){
 const r=await fetch(cal(calendarId)+`/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
 if(!r.ok)return null;return await r.json();
}

export async function GET(req:NextRequest){
 const access=await token();if(!access)return NextResponse.json({error:"login"},{status:401});
 const q=req.nextUrl.searchParams;
 const directId=q.get("id");
 if(directId){
  const calendarId=q.get("calendarId")||"primary";
  const item=await getEvent(access,calendarId,directId);
  if(!item)return NextResponse.json({error:"not_found"},{status:404});
  return NextResponse.json({event:map(item,calendarId)});
 }
 const ids=(q.get("calendarIds")||"primary").split(",").filter(Boolean);
 const params=new URLSearchParams({
  timeMin:q.get("start")??new Date().toISOString(),
  timeMax:q.get("end")??new Date(Date.now()+42*86400000).toISOString(),
  singleEvents:"true",orderBy:"startTime",maxResults:"2500"
 });
 const results=await Promise.all(ids.map(async calendarId=>{
  const r=await fetch(`${cal(calendarId)}?${params}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
  if(!r.ok)return [];
  const data=await r.json();return (data.items??[]).map((x:any)=>map(x,calendarId));
 }));
 return NextResponse.json({events:results.flat().sort((a:any,b:any)=>String(a.start).localeCompare(String(b.start)))});
}

export async function POST(req:NextRequest){
 const access=await token();if(!access)return NextResponse.json({error:"login"},{status:401});
 const body=await req.json();const calendarId=body.calendarId||"primary";
 const r=await fetch(requestUrl(cal(calendarId)),{method:"POST",headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"},body:JSON.stringify(payload(body))});
 if(!r.ok)return NextResponse.json({error:"create",detail:await r.text()},{status:r.status});
 return NextResponse.json({event:map(await r.json(),calendarId)});
}

export async function PATCH(req:NextRequest){
 const access=await token();if(!access)return NextResponse.json({error:"login"},{status:401});
 const body=await req.json();const calendarId=body.calendarId||"primary";
 if(body.editScope==="future"&&body.seriesId){
  const master=await getEvent(access,calendarId,body.seriesId);
  if(!master)return NextResponse.json({error:"master_not_found"},{status:404});
  const until=untilBefore(body.splitFrom,!!body.allDay);
  const trimmed={...master,recurrence:trimRule(master.recurrence??[],until)};
  delete trimmed.id;delete trimmed.etag;delete trimmed.created;delete trimmed.updated;delete trimmed.htmlLink;
  const tr=await fetch(requestUrl(`${cal(calendarId)}/${encodeURIComponent(body.seriesId)}`),{method:"PATCH",headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"},body:JSON.stringify({recurrence:trimmed.recurrence})});
  if(!tr.ok)return NextResponse.json({error:"trim_series",detail:await tr.text()},{status:tr.status});
  const created=await fetch(requestUrl(cal(calendarId)),{method:"POST",headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"},body:JSON.stringify(payload({...body,id:undefined}))});
  if(!created.ok)return NextResponse.json({error:"create_future",detail:await created.text()},{status:created.status});
  return NextResponse.json({event:map(await created.json(),calendarId)});
 }
 const targetId=body.editScope==="series"&&body.seriesId?body.seriesId:body.id;
 const r=await fetch(requestUrl(`${cal(calendarId)}/${encodeURIComponent(targetId)}`),{method:"PATCH",headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"},body:JSON.stringify(payload(body))});
 if(!r.ok)return NextResponse.json({error:"update",detail:await r.text()},{status:r.status});
 return NextResponse.json({event:map(await r.json(),calendarId)});
}

export async function DELETE(req:NextRequest){
 const access=await token();if(!access)return NextResponse.json({error:"login"},{status:401});
 const q=req.nextUrl.searchParams;const id=q.get("id");if(!id)return NextResponse.json({error:"id"},{status:400});
 const calendarId=q.get("calendarId")||"primary";const scope=q.get("scope")||"single";const seriesId=q.get("seriesId");const splitFrom=q.get("splitFrom")||"";
 if(scope==="future"&&seriesId&&splitFrom){
  const master=await getEvent(access,calendarId,seriesId);if(!master)return NextResponse.json({error:"master_not_found"},{status:404});
  const recurrence=trimRule(master.recurrence??[],untilBefore(splitFrom,!!master.start?.date));
  const r=await fetch(requestUrl(`${cal(calendarId)}/${encodeURIComponent(seriesId)}`),{method:"PATCH",headers:{Authorization:`Bearer ${access}`,"Content-Type":"application/json"},body:JSON.stringify({recurrence})});
  if(!r.ok)return NextResponse.json({error:"trim",detail:await r.text()},{status:r.status});
  return NextResponse.json({deleted:true});
 }
 const target=scope==="series"&&seriesId?seriesId:id;
 const r=await fetch(`${cal(calendarId)}/${encodeURIComponent(target)}?sendUpdates=all`,{method:"DELETE",headers:{Authorization:`Bearer ${access}`}});
 if(!r.ok&&r.status!==204)return NextResponse.json({error:"delete",detail:await r.text()},{status:r.status});
 return NextResponse.json({deleted:true});
}
