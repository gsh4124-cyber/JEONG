import assert from "node:assert/strict";import test from "node:test";
const modulePromise=import("./periods"+".ts");
test("week ranges use Monday through Sunday",async()=>{const {getWeekRange}=await modulePromise;assert.deepEqual(getWeekRange("2026-08-10"),{start:"2026-08-10",end:"2026-08-16"})});
test("week range crosses year boundary",async()=>{const {getWeekRange}=await modulePromise;assert.deepEqual(getWeekRange("2027-01-01"),{start:"2026-12-28",end:"2027-01-03"})});
test("month range handles leap February",async()=>{const {getMonthRange}=await modulePromise;assert.deepEqual(getMonthRange("2028-02-12"),{start:"2028-02-01",end:"2028-02-29"})});
test("period navigation crosses boundaries",async()=>{const {getNextWeek,getPreviousWeek,getNextMonth,getPreviousMonth}=await modulePromise;assert.equal(getNextWeek("2026-12-28").start,"2027-01-04");assert.equal(getPreviousWeek("2027-01-04").start,"2026-12-28");assert.equal(getNextMonth("2026-12-01").start,"2027-01-01");assert.equal(getPreviousMonth("2027-01-01").start,"2026-12-01")});
