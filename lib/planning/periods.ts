export type DateRange = { start: string; end: string };
const parse = (value: string | Date) => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [y,m,d] = value.slice(0,10).split("-").map(Number);
  return new Date(y,m-1,d);
};
export const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
export function getWeekRange(value: string | Date): DateRange {
  const date=parse(value); const day=(date.getDay()+6)%7;
  const start=new Date(date); start.setDate(date.getDate()-day);
  const end=new Date(start); end.setDate(start.getDate()+6);
  return {start:formatLocalDate(start),end:formatLocalDate(end)};
}
export function getMonthRange(value: string | Date): DateRange {
  const date=parse(value);
  return {start:formatLocalDate(new Date(date.getFullYear(),date.getMonth(),1)),end:formatLocalDate(new Date(date.getFullYear(),date.getMonth()+1,0))};
}
const shiftDays=(value:string,days:number)=>{const d=parse(value);d.setDate(d.getDate()+days);return formatLocalDate(d)};
const shiftMonths=(value:string,months:number)=>{const d=parse(value);d.setDate(1);d.setMonth(d.getMonth()+months);return formatLocalDate(d)};
export const getPreviousWeek=(value:string)=>getWeekRange(shiftDays(getWeekRange(value).start,-7));
export const getNextWeek=(value:string)=>getWeekRange(shiftDays(getWeekRange(value).start,7));
export const getPreviousMonth=(value:string)=>getMonthRange(shiftMonths(getMonthRange(value).start,-1));
export const getNextMonth=(value:string)=>getMonthRange(shiftMonths(getMonthRange(value).start,1));
