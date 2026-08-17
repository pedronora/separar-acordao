FROM node:20-alpine AS build
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

ARG API_PROXY_TARGET=http://backend:3001
ENV API_PROXY_TARGET=$API_PROXY_TARGET
RUN pnpm build

FROM node:20-alpine AS dev
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
