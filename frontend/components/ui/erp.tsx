import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export type ErpTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'indigo';

const toneStyles: Record<ErpTone, {
  badge: string;
  icon: string;
  border: string;
  soft: string;
  gradient: string;
}> = {
  blue: {
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    icon: 'bg-blue-50 text-blue-700 ring-blue-200',
    border: 'border-blue-200',
    soft: 'bg-blue-50 text-blue-700',
    gradient: 'from-blue-600 to-blue-700',
  },
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    icon: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    border: 'border-emerald-200',
    soft: 'bg-emerald-50 text-emerald-700',
    gradient: 'from-emerald-600 to-teal-600',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    icon: 'bg-amber-50 text-amber-700 ring-amber-200',
    border: 'border-amber-200',
    soft: 'bg-amber-50 text-amber-700',
    gradient: 'from-amber-500 to-orange-500',
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    icon: 'bg-rose-50 text-rose-700 ring-rose-200',
    border: 'border-rose-200',
    soft: 'bg-rose-50 text-rose-700',
    gradient: 'from-rose-600 to-red-600',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    icon: 'bg-slate-100 text-slate-700 ring-slate-200',
    border: 'border-slate-200',
    soft: 'bg-slate-100 text-slate-700',
    gradient: 'from-slate-800 to-slate-950',
  },
  indigo: {
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    icon: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    border: 'border-indigo-200',
    soft: 'bg-indigo-50 text-indigo-700',
    gradient: 'from-indigo-600 to-blue-700',
  },
};

export function erpTone(tone: ErpTone = 'blue') {
  return toneStyles[tone];
}

const iconPaths = {
  dashboard: ['M3.75 13.5h6.75v-9H3.75v9Z', 'M13.5 20.25h6.75v-9H13.5v9Z', 'M13.5 4.5v4.5h6.75V4.5H13.5Z', 'M3.75 20.25h6.75v-3.75H3.75v3.75Z'],
  sales: ['M6.75 6.75h13.5l-1.35 7.65a1.8 1.8 0 0 1-1.78 1.5H9.18a1.8 1.8 0 0 1-1.78-1.5L6.15 4.5H3.75', 'M9 20.25h.01', 'M18 20.25h.01'],
  purchase: ['M4.5 7.5 12 3.75 19.5 7.5v9L12 20.25 4.5 16.5v-9Z', 'M12 12 4.8 7.7', 'M12 12l7.2-4.3', 'M12 12v8.25'],
  finance: ['M4.5 7.5A2.25 2.25 0 0 1 6.75 5.25h10.5A2.25 2.25 0 0 1 19.5 7.5v9a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 16.5v-9Z', 'M4.5 9h15', 'M8.25 14.25h4.5', 'M15.75 14.25h1.5'],
  stock: ['M4.5 7.5 12 3.75l7.5 3.75L12 11.25 4.5 7.5Z', 'M4.5 12 12 15.75 19.5 12', 'M4.5 16.5 12 20.25l7.5-3.75'],
  reports: ['M5.25 19.5V10.5', 'M12 19.5V4.5', 'M18.75 19.5v-7.5', 'M3.75 20.25h16.5'],
  admin: ['M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z', 'M19.5 14.25a1.9 1.9 0 0 0 .38 2.08l-1.5 2.6a1.9 1.9 0 0 0-2.08.38l-.08.08-2.55-1.47a1.9 1.9 0 0 0-3.34 0l-2.55 1.47-.08-.08a1.9 1.9 0 0 0-2.08-.38l-1.5-2.6a1.9 1.9 0 0 0 .38-2.08v-.1H1.5v-3h3v-.1a1.9 1.9 0 0 0-.38-2.08l1.5-2.6a1.9 1.9 0 0 0 2.08-.38l.08-.08 2.55 1.47a1.9 1.9 0 0 0 3.34 0l2.55-1.47.08.08a1.9 1.9 0 0 0 2.08.38l1.5 2.6a1.9 1.9 0 0 0-.38 2.08v.1h3v3h-3v.1Z'],
  table: ['M4.5 5.25h15v13.5h-15V5.25Z', 'M4.5 9.75h15', 'M9.75 5.25v13.5'],
  filter: ['M4.5 5.25h15', 'M7.5 12h9', 'M10.5 18.75h3'],
  plus: ['M12 5.25v13.5', 'M5.25 12h13.5'],
  arrow: ['M13.5 4.5 20.25 12 13.5 19.5', 'M19.5 12H3.75'],
  warning: ['M12 3.75 2.25 20.25h19.5L12 3.75Z', 'M12 9v4.5', 'M12 17.25h.01'],
  check: ['M20.25 6.75 9.75 17.25 4.5 12'],
  empty: ['M4.5 7.5 12 3.75l7.5 3.75v9L12 20.25 4.5 16.5v-9Z', 'M8.25 12h7.5'],
} as const;

export type ErpIconName = keyof typeof iconPaths;

export function ErpIcon({ name, className = 'h-5 w-5', strokeWidth = 1.85 }: { name: ErpIconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {iconPaths[name].map((d, index) => <path key={index} d={d} />)}
    </svg>
  );
}

export function ErpPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-6', className)}>{children}</div>;
}

export function ErpHero({ eyebrow = 'ERP Workspace', title, description, actions, children, tone = 'blue', className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; children?: ReactNode; tone?: ErpTone; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="relative px-5 py-5 md:px-6 md:py-6">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-blue-50/90 to-transparent" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className={cn('mb-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1', erpTone(tone).badge)}>{eyebrow}</div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
            {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children ? <div className="relative mt-5">{children}</div> : null}
      </div>
    </section>
  );
}

export function ErpSectionHeader({ eyebrow = 'ERP Domain', title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between', className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function ErpPanel({ title, description, actions, children, footer, className, bodyClassName }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || description || actions) ? (
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {title ? <h2 className="text-base font-semibold tracking-tight text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-col gap-2 sm:flex-row">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">{footer}</div> : null}
    </section>
  );
}

export function ErpMetricCard({ title, value, subtitle, href, tone = 'blue', icon = 'reports', className }: { title: string; value: string | number; subtitle?: string; href?: string; tone?: ErpTone; icon?: ErpIconName; className?: string }) {
  const content = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">{value}</p>
        {subtitle ? <p className="mt-1.5 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
      </div>
      <span className={cn('grid h-10 w-10 place-items-center rounded-xl ring-1', erpTone(tone).icon)}>
        <ErpIcon name={icon} className="h-5 w-5" />
      </span>
    </div>
  );

  const classes = cn('block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg', className);

  if (href) return <Link href={href} className={classes}>{content}</Link>;
  return <div className={classes}>{content}</div>;
}

export function ErpButton({ variant = 'primary', size = 'md', className, ...props }: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  const variantClass = {
    primary: 'border-transparent bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700',
    secondary: 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  }[variant];
  const sizeClass = size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm';
  return <button className={cn('inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition-colors', variantClass, sizeClass, className)} {...props} />;
}

export function ErpLinkButton({ href, variant = 'primary', size = 'md', className, children }: { href: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; className?: string; children: ReactNode }) {
  const variantClass = {
    primary: 'border-transparent bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700',
    secondary: 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  }[variant];
  const sizeClass = size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm';
  return <Link href={href} className={cn('inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition-colors', variantClass, sizeClass, className)}>{children}</Link>;
}

export function ErpToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>{children}</div>;
}

export function ErpTableShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm', className)}>{children}</div>;
}

export function ErpEmptyState({ title = 'Nuk ka te dhena', description = 'Nuk u gjeten rezultate per filtrat aktuale.', action, icon = 'empty' }: { title?: string; description?: string; action?: ReactNode; icon?: ErpIconName }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 ring-1 ring-slate-200">
        <ErpIcon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErpBadge({ children, tone = 'blue', className }: { children: ReactNode; tone?: ErpTone; className?: string }) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1', erpTone(tone).badge, className)}>{children}</span>;
}
