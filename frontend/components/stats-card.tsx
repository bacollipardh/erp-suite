import { ErpMetricCard } from '@/components/ui/erp';

export function StatsCard(props: {
  title: string;
  value: string | number;
  subtitle?: string;
  href?: string;
}) {
  return <ErpMetricCard {...props} />;
}
