import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PERMISSIONS } from '../auth/permissions';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
};

describe('JwtStrategy', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    jest.clearAllMocks();
  });

  it('loads the current user state from the database on every request', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'manager@erp.local',
      fullName: 'General Manager',
      isActive: true,
      role: { code: 'MANAGER' },
    });

    const strategy = new JwtStrategy(mockPrisma as any);
    const result = await strategy.validate({
      sub: 'user-1',
      email: 'old@erp.local',
      role: 'SALES',
    });

    expect(result.email).toBe('manager@erp.local');
    expect(result.role).toBe('MANAGER');
    expect(result.permissions).toContain(PERMISSIONS.stockAdjust);
    expect(result.permissions).not.toContain(PERMISSIONS.rolesManage);
  });

  it('rejects deleted or inactive users even when the JWT is still valid', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const strategy = new JwtStrategy(mockPrisma as any);

    await expect(
      strategy.validate({
        sub: 'missing-user',
        email: 'user@erp.local',
        role: 'ADMIN',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
