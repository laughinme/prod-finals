export function formatPercent(value: number | null | undefined) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

export function formatDayLabel(day: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(day));
}
