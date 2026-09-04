FROM node:20-alpine AS builder

WORKDIR /app

# Prisma downloads engine checksums during `generate`; ignore missing ones so
# builds don't fail in restricted network environments. Engines are only
# ever generated here, at build time, never at container start.
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

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

# Explicitly (re-)place the generated Prisma Client and query engine binaries
# so they are present and owned correctly before dropping privileges.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

COPY entrypoint.sh ./entrypoint.sh

# Ensure the non-root "node" user can read the pre-generated Prisma Client
# and query engine binaries, and can execute the entrypoint script.
RUN chmod +x ./entrypoint.sh \
  && chown -R node:node /app/node_modules/.prisma /app/node_modules/@prisma /app/prisma

EXPOSE 3000

USER node

# Runtime only applies migrations and starts the app; `prisma generate` is
# never invoked here, avoiding any write attempt under the non-root user.
ENTRYPOINT ["./entrypoint.sh"]
