import { redirect } from 'next/navigation';
import { isoWeekKey, todayInOslo } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default function Home() {
  redirect(`/uke/${isoWeekKey(todayInOslo())}`);
}
