FROM node:20

WORKDIR /app
COPY pnpm-lock.yaml .
COPY pnpm-workspace.yaml .
COPY ui/package.json ./ui/package.json
COPY api/package.json ./api/package.json
COPY packages/yjs/package.json ./packages/yjs/package.json

RUN corepack enable
RUN pnpm i

COPY . .

# WORKDIR /app/ui
# RUN pnpm run build

# WORKDIR /app/api
# RUN pnpm dlx prisma generate && pnpm run build

WORKDIR /app/api
RUN pnpm dlx prisma generate

WORKDIR /app/

CMD ["tail", "-f", "/dev/null"]
