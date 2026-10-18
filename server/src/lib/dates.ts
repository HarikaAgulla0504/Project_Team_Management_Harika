// Dates are stored at UTC midnight (the UI sends YYYY-MM-DD), so "today" is also UTC midnight.
export function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
