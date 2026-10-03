import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class MetaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MetaSignatureGuard.name);
  private static hasWarnedMissingSecret = false;

  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.META_APP_SECRET?.trim();
    if (!secret) {
      if (!MetaSignatureGuard.hasWarnedMissingSecret) {
        this.logger.warn(
          "META_APP_SECRET environment variable is not configured. Rejecting Meta/WhatsApp webhook requests.",
        );
        MetaSignatureGuard.hasWarnedMissingSecret = true;
      }
      throw new UnauthorizedException("Invalid signature");
    }

    const request = context.switchToHttp().getRequest();
    const signatureHeader = request.headers["x-hub-signature-256"];

    if (!signatureHeader || typeof signatureHeader !== "string") {
      throw new UnauthorizedException("Invalid signature");
    }

    if (!signatureHeader.startsWith("sha256=")) {
      throw new UnauthorizedException("Invalid signature");
    }

    const signatureHex = signatureHeader.slice(7);
    if (
      !signatureHex ||
      signatureHex.length % 2 !== 0 ||
      !/^[0-9a-fA-F]+$/.test(signatureHex)
    ) {
      throw new UnauthorizedException("Invalid signature");
    }

    const signatureBuffer = Buffer.from(signatureHex, "hex");

    let bodyBuffer: Buffer;
    if (Buffer.isBuffer(request.rawBody)) {
      bodyBuffer = request.rawBody;
    } else if (typeof request.rawBody === "string") {
      bodyBuffer = Buffer.from(request.rawBody, "utf8");
    } else if (Buffer.isBuffer(request.body)) {
      bodyBuffer = request.body;
    } else if (typeof request.body === "string") {
      bodyBuffer = Buffer.from(request.body, "utf8");
    } else if (request.body && typeof request.body === "object") {
      bodyBuffer = Buffer.from(JSON.stringify(request.body), "utf8");
    } else {
      bodyBuffer = Buffer.from("");
    }

    const expectedHex = crypto
      .createHmac("sha256", secret)
      .update(bodyBuffer)
      .digest("hex");
    const expectedBuffer = Buffer.from(expectedHex, "hex");

    if (expectedBuffer.length !== signatureBuffer.length) {
      throw new UnauthorizedException("Invalid signature");
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    if (!isValid) {
      throw new UnauthorizedException("Invalid signature");
    }

    return true;
  }
}
