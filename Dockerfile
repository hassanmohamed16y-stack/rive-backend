FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL so Prisma's engine (built for debian-openssl-3.0.x) can
# detect libssl during `prisma generate` in this stage.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# `npm ci` triggers the `postinstall` script (`prisma generate`), so the
# Prisma Client and query engine binaries are generated here, at build time.
RUN npm ci

COPY prisma ./prisma
COPY tsconfig*.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

FROM node:20-slim AS runner

WORKDIR /app

# The query engine needs libssl available at runtime too; install it in the
# runner stage so Prisma never has to fetch or write engine binaries here.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Only start the compiled app. Never call `prisma generate` or
# `prisma migrate` here — the client/engines are already baked into the
# image from the builder stage, and migrations are run separately via
# Railway's "Release Command" (see project notes).
CMD ["node", "dist/src/main.js"]
