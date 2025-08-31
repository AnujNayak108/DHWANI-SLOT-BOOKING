// Application configuration
export const APP_CONFIG = {
  // Timezone for all date calculations
  // Common options: 'UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', etc.
  TIMEZONE: 'Asia/Kolkata',
  
  // Week starts on Monday (1) or Sunday (0)
  WEEK_STARTS_ON: 1,
  
  // Available time slots (hour values)
  WEEKDAY_SLOTS: Array.from({ length: 11 }, (_, i) => i + 17), // 17-27 (5:30 PM to 3:30 AM)
  WEEKEND_SLOTS: Array.from({ length: 24 }, (_, i) => i), // 0-23 (24 hours)
} as const;
