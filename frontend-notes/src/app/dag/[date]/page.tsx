import { notFound } from 'next/navigation';
import { DayPage } from '@/components/DayPage';
import { isValidDate } from '@/lib/dates';

export default async function DayRoute({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDate(date)) notFound();

  return <DayPage key={date} date={date} />;
}
