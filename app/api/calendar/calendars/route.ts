import { NextResponse } from "next/server";
import { auth } from "@/auth";
export async function GET(){
 const access=(await auth())?.accessToken;if(!access)return NextResponse.json({error:"login"},{status:401});
 const r=await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",{headers:{Authorization:`Bearer ${access}`},cache:"no-store"});
 if(!r.ok)return NextResponse.json({calendars:[{id:"primary",name:"기본 캘린더",primary:true}]});
 const data=await r.json();
 return NextResponse.json({calendars:(data.items??[]).map((x:any)=>({id:x.id,name:x.summaryOverride??x.summary??x.id,primary:!!x.primary,color:x.backgroundColor}))});
}
