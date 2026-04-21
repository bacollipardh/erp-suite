import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const mockUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'admin@erp.local',
  passwordHash: '',
  isActive: true,
  role: { code: 'ADMIN' },
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('Admin123!', 12);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } })],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should return accessToken on valid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
    const result = await service.login({ email: 'admin@erp.local', password: 'Admin123!' });
    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe('admin@erp.local');
  });

  it('normalizes the email before querying Prisma', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

    await service.login({ email: '  ADMIN@ERP.LOCAL ', password: 'Admin123!' });

    expect(mockPrisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { email: 'admin@erp.local' },
      include: { role: true },
    });
  });

  it('should throw on invalid password', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
    await expect(service.login({ email: 'admin@erp.local', password: 'wrong' })).rejects.toThrow();
  });

  it('should throw on unknown email', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.login({ email: 'nobody@erp.local', password: 'Admin123!' })).rejects.toThrow();
  });

  it('should reject inactive users when loading the current session', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      ...mockUser,
      isActive: false,
    });

    await expect(service.me(mockUser.id)).rejects.toThrow();
  });
});
