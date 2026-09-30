import assert from "node:assert/strict";
import test from "node:test";

import { addCalendarDays, sanAntonioDate } from "./dates.ts";

test("sanAntonioDate uses America/Chicago instead of UTC", () => {
  assert.equal(sanAntonioDate(new Date("2026-09-24T04:30:00Z")), "2026-09-23");
  assert.equal(sanAntonioDate(new Date("2026-09-24T05:30:00Z")), "2026-09-24");
});

test("addCalendarDays handles month boundaries", () => {
  assert.equal(addCalendarDays("2026-09-30", 1), "2026-10-01");
  assert.equal(addCalendarDays("2026-09-23", 90), "2026-12-22");
});
