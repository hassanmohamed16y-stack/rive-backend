import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

@Injectable()
export class FullAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.roleName !== "full_admin") {
      throw new ForbiddenException(
        "Only full_admin can perform this action",
      );
    }

    return true;
  }
}
