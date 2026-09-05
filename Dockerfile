FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL so Prisma's engine (built for debian-openssl-3.0.x) can
# detect libssl during `prisma generate` in this stage.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

# `npm ci` triggers the `postinstall` script (`prisma generate`), so the
# Prisma Client and query engine binaries are generated here, at build time.
# The prisma folder must already be present above for this to work.
RUN npm ci

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

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 3000

# Only start the compiled app. Never call `prisma generate` or
# `prisma migrate` here — the client/engines are already baked into the
# image from the builder stage, and migrations are run separately via
# Railway's "Release Command" (see project notes).
# NOTE: this project's tsconfig/nest-cli output the compiled entry file to
# dist/src/main.js (see package.json's "start:prod" script), not dist/main.js.
CMD ["node", "dist/src/main.js"]
