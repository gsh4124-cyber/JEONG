import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(){
 const session=await auth();
 if(!session?.accessToken)return NextResponse.json({error:"login"},{status:401});
 const contacts:any[]=[];
 let pageToken="";
 try{
  do{
   const params=new URLSearchParams({
    personFields:"names,emailAddresses,phoneNumbers,organizations",
    pageSize:"1000",
    sortOrder:"FIRST_NAME_ASCENDING"
   });
   if(pageToken)params.set("pageToken",pageToken);
   const response=await fetch(`https://people.googleapis.com/v1/people/me/connections?${params}`,{
    headers:{Authorization:`Bearer ${session.accessToken}`},
    cache:"no-store"
   });
   if(!response.ok)return NextResponse.json({error:"google_contacts",detail:await response.text()},{status:response.status});
   const data=await response.json();
   for(const person of data.connections??[]){
    const name=person.names?.[0]?.displayName??"";
    const phone=person.phoneNumbers?.[0]?.value??"";
    const email=person.emailAddresses?.[0]?.value??"";
    const organization=person.organizations?.[0]?.name??"";
    if(name||phone||email)contacts.push({name,phone,email,organization,tags:["Google"]});
   }
   pageToken=data.nextPageToken??"";
  }while(pageToken);
  return NextResponse.json({contacts});
 }catch{
  return NextResponse.json({error:"google_contacts"},{status:500});
 }
}
