const LOCALE = "en-US";

function zone(): { timeZone?: string } {
  if (typeof window !== "undefined" && window.quodexNative?.isNative) return {};
  return { timeZone: "America/New_York" };
}

export function updateAge(since: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 60 * 60) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 24 * 60 * 60) {
    const hours = Math.floor(seconds / (60 * 60));
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(seconds / (24 * 60 * 60));
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function relativeShort(from: number, now: number): string {
  const interval = (from - now) / 1000;
  if (Math.abs(interval) < 60) return interval >= 0 ? "now" : "just now";
  if (interval > 0 && interval < 24 * 60 * 60) {
    const hours = Math.floor(interval / 3600);
    const minutes = Math.floor((interval % 3600) / 60);
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${Math.max(1, minutes)}m`;
  }
  if (interval < 0 && Math.abs(interval) < 24 * 60 * 60) {
    const minutes = Math.max(1, Math.floor(Math.abs(interval) / 60));
    return minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
  }
  return clockWithWeekday(from, now);
}

export function resetCountdown(date: number, now: number): string {
  const seconds = Math.max(0, Math.floor((date - now) / 1000));
  if (seconds < 60) return "now";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${Math.max(1, minutes)}m`;
}

export function clockTime(date: number): string {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    ...zone(),
  });
}

export function clockWithWeekday(date: number, now: number): string {
  const target = new Date(date);
  const current = new Date(now);
  const sameDay = new Intl.DateTimeFormat(LOCALE, {
    ...zone(),
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(target) === new Intl.DateTimeFormat(LOCALE, {
    ...zone(),
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(current);
  if (sameDay) return clockTime(date);
  return target.toLocaleString(LOCALE, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    ...zone(),
  });
}

export function resetCompact(date: number, now: number, prefix = ""): string {
  return `${prefix}${resetCountdown(date, now)} · ${clockWithWeekday(date, now)}`;
}

export function formatTaskbarTime(now: number): { time: string; date: string } {
  const date = new Date(now);
  return {
    time: date.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit", ...zone() }),
    date: date.toLocaleDateString(LOCALE, { month: "numeric", day: "numeric", year: "numeric", ...zone() }),
  };
}

export function formatCalendarHeading(now: number): string {
  return new Date(now).toLocaleDateString(LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...zone(),
  });
}
