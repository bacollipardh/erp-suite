import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../decorators/current-user.decorator';
import { AUTH_COOKIE_NAME, getPermissionsForRole } from '../permissions';
import { PrismaService } from '../../prisma/prisma.service';

function extractTokenFromCookie(request: { headers?: { cookie?: string } }) {
  const cookieHeader = request?.headers?.cookie;
  if (!cookieHeader) return null;

  const pair = cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .find((chunk) => chunk.startsWith(`${AUTH_COOKIE_NAME}=`));

  if (!pair) return null;
  return decodeURIComponent(pair.split('=').slice(1).join('='));
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractTokenFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive || !user.role?.code) {
      throw new UnauthorizedException();
    }

    return {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.code,
      permissions: getPermissionsForRole(user.role.code),
      isActive: user.isActive,
    } satisfies JwtPayload;
  }
}
