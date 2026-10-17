export function formatThaiDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatThaiLongDateTime(value: Date | string) {
  const date = new Date(value);
  const dateLabel = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok",
  }).format(date);
  return `${dateLabel} เวลา ${timeLabel} น.`;
}
