import { addDays, startOfWeek, format } from 'date-fns';

export function getCurrentWeekDates(): string[] {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  return Array.from({ length: 7 }).map((_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}

export function getWeekKey(date: Date = new Date()): string {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return format(start, 'yyyy-ww');
}



