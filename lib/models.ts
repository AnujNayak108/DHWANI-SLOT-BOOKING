export type UserDoc = {
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: number;
};

export type BookingDoc = {
  userId: string;
  date: string; // YYYY-MM-DD
  slot: number; // 0-23 hour
  createdAt: number;
};

export type WeekViewSlot = {
  date: string; // YYYY-MM-DD
  slot: number; // hour 0-23
  bookedByUserId?: string;
};



