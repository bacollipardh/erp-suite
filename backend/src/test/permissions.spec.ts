import { PERMISSIONS, getPermissionsForRole, hasPermissions } from '../auth/permissions';

describe('Permission matrix', () => {
  it('grants every permission to ADMIN', () => {
    const permissions = getPermissionsForRole('ADMIN');

    expect(permissions).toContain(PERMISSIONS.rolesManage);
    expect(permissions).toContain(PERMISSIONS.stockTransfer);
    expect(permissions).toContain(PERMISSIONS.fiscalize);
    expect(hasPermissions('ADMIN', [PERMISSIONS.rolesManage, PERMISSIONS.fiscalize])).toBe(true);
  });

  it('allows MANAGER to operate stock but not manage roles', () => {
    const permissions = getPermissionsForRole('MANAGER');

    expect(permissions).toContain(PERMISSIONS.stockAdjust);
    expect(permissions).toContain(PERMISSIONS.stockTransfer);
    expect(permissions).toContain(PERMISSIONS.accountingRead);
    expect(permissions).toContain(PERMISSIONS.reportsAccounting);
    expect(permissions).not.toContain(PERMISSIONS.rolesManage);
    expect(hasPermissions('MANAGER', [PERMISSIONS.stockAdjust, PERMISSIONS.stockTransfer])).toBe(true);
    expect(hasPermissions('MANAGER', [PERMISSIONS.rolesManage])).toBe(false);
  });

  it('limits SALES to sales-facing permissions', () => {
    const permissions = getPermissionsForRole('SALES');

    expect(permissions).toContain(PERMISSIONS.salesInvoicesManage);
    expect(permissions).toContain(PERMISSIONS.salesReturnsManage);
    expect(permissions).not.toContain(PERMISSIONS.purchaseInvoicesManage);
    expect(permissions).not.toContain(PERMISSIONS.stockAdjust);
    expect(permissions).not.toContain(PERMISSIONS.accountingRead);
    expect(permissions).not.toContain(PERMISSIONS.reportsAccounting);
  });

  it('returns no permissions for unknown roles', () => {
    expect(getPermissionsForRole('UNKNOWN')).toEqual([]);
    expect(hasPermissions('UNKNOWN', [PERMISSIONS.dashboard])).toBe(false);
  });
});
