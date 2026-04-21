import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Permission } from '../permissions';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  fullName?: string;
  permissions?: Permission[];
  isActive?: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
