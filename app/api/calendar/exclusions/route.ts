import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
const HOLIDAY_CALENDAR="ko.south_korea#holiday@group.v.calendar.google.com";

function parse(value:string){const [y,m,d]=value.split("-").map(Number);return new Date(y,m-1,d)}
function fmt(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function add(value:string,days:number){const d=parse(value);d.setDate(d.getDate()+days);return fmt(d)}
function weekend(value:string){const n=parse(value).getDay();return n===0||n===6}

export async function GET(req:NextRequest){
 const start=req.nextUrl.searchParams.get("start"),end=req.nextUrl.searchParams.get("end");
 if(!start||!end)return NextResponse.json({dates:[],moved:[]});
 const includeHolidays=req.nextUrl.searchParams.get("holidays")==="true";
 const includeWeekends=req.nextUrl.searchParams.get("weekends")==="true";
 const policy=req.nextUrl.searchParams.get("policy")||"skip";
 const weekends=new Set<string>(),holidays=new Set<string>();
 for(let d=start;d<=end;d=add(d,1))if(weekend(d))weekends.add(d);

 if(includeHolidays){
  const access=(await auth())?.accessToken;
  if(access){
   const params=new URLSearchParams({timeMin:new Date(`${start}T00:00:00+09:00`).toISOString(),timeMax:new Date(`${add(end,1)}T00:00:00+09:00`).toISOString(),singleEvents:"true",orderBy:"startTime",maxResults:"2500"});
   try{
    const r=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(HOLIDAY_CALENDAR)}/events?${params}`,{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
    if(r.ok){const data=await r.json();for(const item of data.items??[]){const date=item.start?.date??item.start?.dateTime?.slice(0,10);if(date)holidays.add(date)}}
   }catch{}
  }
 }
 const dates=new Set<string>();
 if(includeWeekends)for(const d of weekends)dates.add(d);
 if(includeHolidays)for(const d of holidays)dates.add(d);
 const moved:{from:string;to:string}[]=[];
 if(includeHolidays&&policy!=="skip"){
  for(const from of holidays){
   let to=from;const step=policy==="next"?1:-1;
   do{to=add(to,step)}while(weekend(to)||holidays.has(to));
   moved.push({from,to});
  }
 }
 return NextResponse.json({dates:[...dates].sort(),moved});
}
