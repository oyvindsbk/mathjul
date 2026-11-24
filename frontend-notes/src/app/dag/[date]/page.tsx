import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { DayPage } from '@/components/DayPage';
import { isValidDate } from '@/lib/dates';

export default async function DayRoute({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDate(date)) notFound();

  return (
    <>
      <AppHeader />
      <DayPage key={date} date={date} />
    </>
  );
}
