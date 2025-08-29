import LoginButton from '@/components/LoginButton';
import WeekCalendar from '@/components/WeekCalendar';
import CancellationRequests from '@/components/CancellationRequests';

export default function Home() {
  return (
    <div className="min-h-screen p-6 sm:p-10">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Music Room Booking</h1>
        <LoginButton />
      </header>
      <div className="space-y-8">
        <WeekCalendar />
        <CancellationRequests />
      </div>
    </div>
  );
}
