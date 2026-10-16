FROM node:26-slim AS web
RUN npm i -g pnpm@12.14.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @feelingmark/mobile build:web

FROM node:26-slim
RUN npm i -g pnpm@12.14.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile --prod --filter @feelingmark/server
COPY apps/server/src apps/server/src
COPY --from=web /app/apps/mobile/dist /app/web
WORKDIR /app/apps/server
ENV WEB_DIR=/app/web STORAGE_PATH=/data/photos DATABASE_PATH=/data/feelingmark.sqlite PORT=8787
VOLUME /data
EXPOSE 8787
CMD ["node", "src/index.ts"]
