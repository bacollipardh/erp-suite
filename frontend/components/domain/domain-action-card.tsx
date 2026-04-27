import { ErpBadge, ErpIcon, ErpLinkButton, type ErpTone } from '@/components/ui/erp';

const toneMap = {
  slate: 'slate',
  indigo: 'blue',
  emerald: 'emerald',
  amber: 'amber',
} as const;

export function DomainActionCard({
  title,
  description,
  href,
  badge,
  tone = 'slate',
}: {
  title: string;
  description: string;
  href: string;
  badge?: string;
  tone?: keyof typeof toneMap;
}) {
  const mappedTone = toneMap[tone] as ErpTone;

  return (
    <ErpLinkButton
      href={href}
      variant="secondary"
      className="group block h-full rounded-2xl p-5 text-left hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-lg"
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span>
          {badge ? <ErpBadge tone={mappedTone}>{badge}</ErpBadge> : null}
          <span className="mt-4 block text-base font-semibold text-slate-950 group-hover:text-blue-700">
            {title}
          </span>
          <span className="mt-2 block text-sm leading-6 text-slate-500">{description}</span>
        </span>
        <span className="rounded-xl bg-slate-50 p-2 text-slate-400 ring-1 ring-slate-200 transition-colors group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:ring-blue-200">
          <ErpIcon name="arrow" className="h-4 w-4" />
        </span>
      </span>
    </ErpLinkButton>
  );
}
