import { StatsCard } from '@/components/stats-card';

export function formatQty(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('sq-AL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export function locationLabel(location?: {
  code?: string | null;
  zone?: string | null;
  aisle?: string | null;
  rack?: string | null;
  shelf?: string | null;
  bin?: string | null;
}) {
  if (!location) return '-';
  return [location.code, location.zone, location.aisle, location.rack, location.shelf, location.bin]
    .filter(Boolean)
    .join(' / ') || '-';
}

export function WmsSummaryCards({
  summary,
}: {
  summary?: {
    warehouseCount?: number;
    locationCount?: number;
    itemCount?: number;
    qtyOnHand?: number;
    availableQty?: number;
    reservedQty?: number;
    pickedQty?: number;
  } | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatsCard title="Ne dore" value={formatQty(summary?.qtyOnHand)} subtitle="Sasia totale WMS" />
      <StatsCard title="E lire" value={formatQty(summary?.availableQty)} subtitle="Gati per alokim" />
      <StatsCard title="Rezervuar" value={formatQty(summary?.reservedQty)} subtitle="E lidhur me porosi" />
      <StatsCard title="Picked" value={formatQty(summary?.pickedQty)} subtitle="Gati per postim/dalje" />
    </div>
  );
}
