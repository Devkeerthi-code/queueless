/** India has no DST, so IST is a fixed +05:30 offset. Everything business-related is in IST. */
export const IST_OFFSET_MIN = 330;
const MS_PER_MIN = 60_000;

type IstParts = { year: number; month: number; day: number; minuteOfDay: number; weekday: number };

export function istParts(at: Date): IstParts {
  const shifted = new Date(at.getTime() + IST_OFFSET_MIN * MS_PER_MIN);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** The IST calendar date as a UTC-midnight Date, which is how Postgres DATE columns round-trip. */
export function businessDate(at: Date): Date {
  const p = istParts(at);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The instant for `minuteOfDay` IST on the given business date. */
export function istInstant(day: Date, minuteOfDay: number): Date {
  return new Date(day.getTime() + (minuteOfDay - IST_OFFSET_MIN) * MS_PER_MIN);
}

export function addDays(day: Date, days: number): Date {
  return new Date(day.getTime() + days * 86_400_000);
}

/** Indian financial year, April to March, e.g. "2026-27". */
export function financialYear(at: Date): string {
  const p = istParts(at);
  const start = p.month >= 4 ? p.year : p.year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function formatMinute(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatIstTime(at: Date): string {
  return formatMinute(istParts(at).minuteOfDay);
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export function formatIstDate(at: Date): string {
  return dateFmt.format(at);
}

export function formatIstDateTime(at: Date): string {
  return `${formatIstDate(at)}, ${formatIstTime(at)}`;
}

/** "13:30" -> 810. Returns null for anything that isn't a valid 24h time. */
export function parseHhMm(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function toHhMm(minuteOfDay: number): string {
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;
}
