'use client';

import { hasPermission } from '@/lib/permissions';
import { useSession } from './session-provider';
import { ErpHero, ErpIcon, ErpLinkButton } from '@/components/ui/erp';

export function PageHeader({
  title,
  description,
  createHref,
  createLabel = 'I ri',
  createPermission,
}: {
  title: string;
  description?: string;
  createHref?: string;
  createLabel?: string;
  createPermission?: string;
}) {
  const { user } = useSession();
  const canCreate = Boolean(createHref && hasPermission(user?.permissions, createPermission));

  return (
    <div className="mb-6">
      <ErpHero
        title={title}
        description={description}
        actions={
          canCreate ? (
            <ErpLinkButton href={createHref!}>
              <ErpIcon name="plus" className="h-4 w-4" />
              {createLabel}
            </ErpLinkButton>
          ) : null
        }
      />
    </div>
  );
}
