export function isCalendarDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !!new Date(`${value}T00:00Z`).toJSON()?.startsWith(value);
}

export function unambiguousCalendarDate(value: string) {
  const dates = value.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  return dates.length === 1 && isCalendarDate(dates[0]) && dates[0];
}
