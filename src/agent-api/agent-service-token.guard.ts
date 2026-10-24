import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeStringEqual } from "../common/utils/timing-safe-compare";

/**
 * Authenticates the AI agent (n8n) with its own service token:
 *   Authorization: Bearer <AGENT_SERVICE_TOKEN>
 * The token is separate from admin logins, so it can be rotated or revoked
 * without touching anyone's account. No token configured = API switched off.
 */
@Injectable()
export class AgentServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.AGENT_SERVICE_TOKEN;
    if (!expected || expected.length < 32) {
      throw new ServiceUnavailableException("Agent API is not enabled");
    }
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const header = request.headers["authorization"];
    const value = Array.isArray(header) ? header[0] : header;
    const token = value?.startsWith("Bearer ")
      ? value.slice("Bearer ".length)
      : undefined;
    if (!timingSafeStringEqual(token, expected)) {
      throw new UnauthorizedException("Invalid agent token");
    }
    return true;
  }
}
