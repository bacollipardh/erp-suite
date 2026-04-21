import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../decorators/current-user.decorator';
import { AUTH_COOKIE_NAME } from '../permissions';

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
  constructor() {
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
    return payload;
  }
}
