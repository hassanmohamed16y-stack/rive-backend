FROM node:20-alpine AS builder

WORKDIR /app

# Prisma downloads engine checksums during `generate`; ignore missing ones so
# builds don't fail in restricted network environments. Engines are only
# ever generated here, at build time, never at container start.
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

RUN apk add --no-cache libc6-compat openssl openssl-dev

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig*.json ./
COPY src ./src

# `npm run build` runs `prisma generate` followed by `nest build`, so the
# Prisma Client and query engine binaries are generated here at build time.
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

# Prisma's query engine needs OpenSSL to detect libssl at runtime; without
# it Prisma logs "failed to detect the libssl/openssl" warnings/errors.
RUN apk add --no-cache libc6-compat openssl openssl-dev

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY .env.example ./.env.example

# Explicitly (re-)place the generated Prisma Client and query engine binaries
# so they are present in the final image.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

EXPOSE 3000

# Run as root so the container can write to node_modules/@prisma (and any
# other files) inside restrictive platforms like Railway. This avoids
# "Can't write to /app/node_modules/@prisma/engines" permission errors.
# USER node

# Runtime only applies migrations and starts the app; `prisma generate` is
# never invoked here.
ENTRYPOINT ["./entrypoint.sh"]
