FROM node:24-alpine AS base
RUN npm install -g pnpm@11
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG CORS_ORIGIN=http://localhost:3000
ENV CORS_ORIGIN=$CORS_ORIGIN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx nuxi prepare && pnpm prisma generate && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/server/generated ./server/generated
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
RUN chown -R node:node /app/node_modules && mkdir -p /tmp/uploads /app/.pnpm-store && chown -R node:node /tmp/uploads /app/.pnpm-store
EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/recover-lotes.ts && npx tsx scripts/seed-if-empty.ts && node .output/server/index.mjs"]
