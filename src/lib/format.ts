export const coinLabel = (n: number) => `LoveCoin #${String(n).padStart(8, "0")}`;

export const formatNumber = (n: number) => n.toLocaleString("en-US");

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function dayGroupLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff <= 0) return "TODAY";
  if (diff === 1) return "YESTERDAY";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase();
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
