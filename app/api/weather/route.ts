import { NextRequest, NextResponse } from "next/server";

export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams;
 const lat=Number(q.get("lat")||35.1595);
 const lon=Number(q.get("lon")||126.8526);
 const location=q.get("location")||"광주";
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return NextResponse.json({error:"coordinates"},{status:400});
 const params=new URLSearchParams({
  latitude:String(lat),longitude:String(lon),
  current:"temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
  timezone:"auto"
 });
 try{
  const r=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`,{cache:"no-store"});
  if(!r.ok)return NextResponse.json({error:"weather"},{status:r.status});
  const data=await r.json();
  return NextResponse.json({
   temperature:Number(data.current?.temperature_2m??0),
   apparent:Number(data.current?.apparent_temperature??0),
   code:Number(data.current?.weather_code??0),
   wind:Number(data.current?.wind_speed_10m??0),
   location
  });
 }catch{return NextResponse.json({error:"weather"},{status:500})}
}
