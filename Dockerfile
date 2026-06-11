FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/sso/package.json packages/sso/package.json
COPY packages/sso-fixtures/package.json packages/sso-fixtures/package.json
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV KAGED_SSO_PORT=8787
EXPOSE 8787
USER bun
ENTRYPOINT ["bun", "run", "packages/sso/src/main.ts"]
