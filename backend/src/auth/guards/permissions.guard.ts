import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../decorators/current-user.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, hasPermissions } from '../permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    const role = user?.role;
    const currentPermissions = user?.permissions ?? [];

    const allowed =
      currentPermissions.length > 0
        ? required.every((permission) => currentPermissions.includes(permission))
        : !!role && hasPermissions(role, required);

    if (!allowed) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
