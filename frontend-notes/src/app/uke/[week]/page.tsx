import { notFound } from 'next/navigation';
import { WeekView } from '@/components/WeekView';
import { mondayOfWeek } from '@/lib/dates';

export default async function WeekPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const monday = mondayOfWeek(week);
  if (!monday) notFound();

  return <WeekView key={week} weekKey={week} monday={monday} />;
}
