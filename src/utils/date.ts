const THAI_LOCALE = "th-TH";

export function formatThaiDateTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(THAI_LOCALE, {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone
  }).format(value);
}
