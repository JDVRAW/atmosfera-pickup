import { describe, expect, it } from "vitest";
import { fromSquarePeriods, isOpenNow, localMinutesToIso, pickupSlotsToday } from "@/lib/hours";
import type { OpeningPeriod } from "@/lib/types";

const TZ = "America/New_York";
const hours: OpeningPeriod[] = [
  { day: "MON", start: "07:00", end: "15:00" },
  { day: "SAT", start: "08:00", end: "12:00" },
];
// Monday 2026-11-23. New York is UTC-5 in November.
const at = (hhmm: string) => new Date(`2026-11-23T${hhmm}:00-05:00`);

describe("isOpenNow", () => {
  it("is open inside Monday's hours and closed outside them", () => {
    expect(isOpenNow(at("06:59"), hours, TZ)).toBe(false);
    expect(isOpenNow(at("07:00"), hours, TZ)).toBe(true);
    expect(isOpenNow(at("14:59"), hours, TZ)).toBe(true);
    expect(isOpenNow(at("15:00"), hours, TZ)).toBe(false);
  });

  it("uses the shop's time zone, not the server's", () => {
    // 13:00 UTC is 08:00 in New York, so open.
    expect(isOpenNow(new Date("2026-11-23T13:00:00Z"), hours, TZ)).toBe(true);
  });

  it("treats a shop with no hours set as always open", () => {
    expect(isOpenNow(at("03:00"), [], TZ)).toBe(true);
  });
});

describe("pickupSlotsToday", () => {
  it("starts after prep time plus one step and stops before closing", () => {
    const slots = pickupSlotsToday(at("14:10"), hours, TZ, 10, 15);
    expect(slots.map((s) => s.label)).toEqual(["2:45 PM"]);
  });

  it("returns nothing after closing", () => {
    expect(pickupSlotsToday(at("15:30"), hours, TZ)).toEqual([]);
  });

  it("before opening, offers slots from opening time", () => {
    expect(pickupSlotsToday(at("05:00"), hours, TZ)[0].label).toBe("7:00 AM");
  });
});

describe("localMinutesToIso", () => {
  it("converts a shop-local time today to UTC", () => {
    expect(localMinutesToIso(at("09:00"), 14 * 60 + 45, TZ)).toBe("2026-11-23T19:45:00.000Z");
  });
});

describe("fromSquarePeriods", () => {
  it("maps Square business hours and skips incomplete periods", () => {
    expect(
      fromSquarePeriods([
        { dayOfWeek: "MON", startLocalTime: "07:00:00", endLocalTime: "15:00:00" },
        { dayOfWeek: "TUE", startLocalTime: null, endLocalTime: "15:00:00" },
      ]),
    ).toEqual([{ day: "MON", start: "07:00", end: "15:00" }]);
  });
});
