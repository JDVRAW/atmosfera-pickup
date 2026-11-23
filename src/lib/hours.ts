import type { OpeningPeriod } from "./types";

const DAYS: OpeningPeriod["day"][] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** The shop-local weekday and minutes since midnight for an instant. */
export function localParts(at: Date, timezone: string): { day: OpeningPeriod["day"]; minutes: number; ymd: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").toUpperCase().slice(0, 3) as OpeningPeriod["day"];
  return {
    day,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Today's open windows in minutes since midnight, sorted. */
function windowsFor(day: OpeningPeriod["day"], hours: OpeningPeriod[]): [number, number][] {
  return hours
    .filter((p) => p.day === day)
    .map((p) => [toMinutes(p.start), toMinutes(p.end)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
}

/**
 * Whether the shop takes orders right now. With no hours set in Square we
 * treat the shop as always open, so the app still works before hours are set.
 */
export function isOpenNow(at: Date, hours: OpeningPeriod[], timezone: string): boolean {
  if (hours.length === 0) return true;
  const { day, minutes } = localParts(at, timezone);
  return windowsFor(day, hours).some(([s, e]) => minutes >= s && minutes < e);
}

export type PickupSlot = { label: string; minutesFromMidnight: number };

/**
 * Later-today pickup slots every `stepMinutes`, starting at least
 * `prepMinutes` from now and ending before closing.
 */
export function pickupSlotsToday(
  at: Date,
  hours: OpeningPeriod[],
  timezone: string,
  prepMinutes = 10,
  stepMinutes = 15,
): PickupSlot[] {
  const { day, minutes } = localParts(at, timezone);
  const windows = hours.length === 0 ? ([[0, 24 * 60]] as [number, number][]) : windowsFor(day, hours);
  const earliest = minutes + prepMinutes + stepMinutes; // ASAP covers the first slot
  const slots: PickupSlot[] = [];
  for (const [s, e] of windows) {
    let t = Math.max(s, Math.ceil(earliest / stepMinutes) * stepMinutes);
    for (; t < e; t += stepMinutes) slots.push({ minutesFromMidnight: t, label: formatClock(t) });
  }
  return slots;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Convert a shop-local "minutes since midnight today" to a UTC ISO string.
 * Works by measuring the shop's UTC offset at that moment.
 */
export function localMinutesToIso(at: Date, minutes: number, timezone: string): string {
  const { ymd } = localParts(at, timezone);
  const [y, mo, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  const offset = (t: number) => {
    const p = localParts(new Date(t), timezone);
    const [py, pm, pd] = p.ymd.split("-").map(Number);
    return Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60) - t;
  };
  const first = guess - offset(guess);
  return new Date(guess - offset(first)).toISOString();
}

/** Human summary like "Mon to Fri 7:00 AM to 3:00 PM" for each listed day. */
export function hoursByDay(hours: OpeningPeriod[]): { day: string; text: string }[] {
  const names: Record<OpeningPeriod["day"], string> = {
    SUN: "Sunday", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday",
  };
  const order = [...DAYS.slice(1), "SUN"] as OpeningPeriod["day"][];
  return order.map((d) => {
    const w = windowsFor(d, hours);
    return {
      day: names[d],
      text: w.length === 0 ? "Closed" : w.map(([s, e]) => `${formatClock(s)} to ${formatClock(e)}`).join(", "),
    };
  });
}

/** Map Square's businessHours.periods to our shape. */
export function fromSquarePeriods(
  periods: { dayOfWeek?: string | null; startLocalTime?: string | null; endLocalTime?: string | null }[] | null | undefined,
): OpeningPeriod[] {
  return (periods ?? [])
    .filter((p) => p.dayOfWeek && p.startLocalTime && p.endLocalTime && DAYS.includes(p.dayOfWeek as OpeningPeriod["day"]))
    .map((p) => ({
      day: p.dayOfWeek as OpeningPeriod["day"],
      start: p.startLocalTime!.slice(0, 5),
      end: p.endLocalTime!.slice(0, 5),
    }));
}
