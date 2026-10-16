/** Celdas de un mes: fechas ISO (YYYY-MM-DD) o null de relleno; múltiplo de 7. weekStart: 0=domingo, 1=lunes. */
export function monthGrid(year: number, month: number, weekStart = 1): (string | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() - weekStart + 7) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  const mm = String(month).padStart(2, "0");
  for (let d = 1; d <= days; d++) cells.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
