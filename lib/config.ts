// Application configuration
export const APP_CONFIG = {
  // Timezone for all date calculations
  // Common options: 'UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', etc.
  TIMEZONE: 'Asia/Kolkata',
  
  // Week starts on Monday (1) or Sunday (0)
  WEEK_STARTS_ON: 0,
  
  // Available time slots (hour values)
  // Weekday slots: 17-27 (5:30 PM to 3:30 AM next day) - 11 slots
  WEEKDAY_SLOTS: Array.from({ length: 11 }, (_, i) => i + 17),
  
  // Weekend slots: Hourly slots from morning to night
  // Each band can book 2 slots of 1 hour each on weekends
  // Weekend slots start from 8 AM (8) to 11 PM (23) - 16 hourly slots
  WEEKEND_START_HOUR: 8,  // 8 AM
  WEEKEND_END_HOUR: 23,   // 11 PM
  WEEKEND_SLOTS: Array.from({ length: 16 }, (_, i) => i + 8), // 8-23 (8 AM to 11 PM)
  
  // Maximum slots a band can book on weekends
  WEEKEND_MAX_SLOTS_PER_BAND: 2,
} as const;

// Logo path for loading page (can be overridden via environment variable)
// Use empty string to show default emoji instead
export const LOGO_PATH = process.env.NEXT_PUBLIC_LOGO_PATH || '';

// Helper to check if a date is a weekend (Saturday = 6, Sunday = 0)
export function isWeekend(dateString: string): boolean {
  const date = new Date(dateString);
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

// Helper to get day name
export function getDayName(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}
