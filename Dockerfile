FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig*.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY .env.example ./.env.example

# Ensure the non-root "node" user can read the pre-generated Prisma Client
# and query engine binaries so no write/generate is attempted at runtime.
RUN chown -R node:node /app/node_modules/.prisma /app/node_modules/@prisma /app/prisma

EXPOSE 3000

USER node

# PRISMA_CLI_QUERY_ENGINE_TYPE etc. are already baked in from the build stage;
# only run migrations at startup, never `prisma generate`.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
