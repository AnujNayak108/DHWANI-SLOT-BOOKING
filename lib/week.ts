import { addDays, startOfWeek, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { APP_CONFIG } from './config';

// Get current date in the specified timezone
export function getCurrentZonedDate(): Date {
  const now = new Date();
  return toZonedTime(now, APP_CONFIG.TIMEZONE);
}

// Format a date consistently in the specified timezone
export function formatZonedDate(date: Date, formatString: string = 'yyyy-MM-dd'): string {
  const zonedDate = toZonedTime(date, APP_CONFIG.TIMEZONE);
  return format(zonedDate, formatString);
}

export function getCurrentWeekDates(): string[] {
  // Get current date in the specified timezone
  const zonedNow = getCurrentZonedDate();
  
  // Get the start of the week (Monday) in the specified timezone
  const start = startOfWeek(zonedNow, { weekStartsOn: APP_CONFIG.WEEK_STARTS_ON });
  
  // Generate dates directly in the timezone without converting back to UTC
  return Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(start, i);
    return format(date, 'yyyy-MM-dd');
  });
}

export function getWeekKey(date: Date = new Date()): string {
  // Convert the input date to the specified timezone
  const zonedDate = toZonedTime(date, APP_CONFIG.TIMEZONE);
  const start = startOfWeek(zonedDate, { weekStartsOn: APP_CONFIG.WEEK_STARTS_ON });
  return format(start, 'yyyy-MM-dd');
}



