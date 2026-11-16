ARG BUILD_IMAGE=docker.io/library/node:26-trixie-slim
ARG RUNTIME_IMAGE=gcr.io/distroless/nodejs26-debian13:nonroot-amd64

FROM ${BUILD_IMAGE} AS build
ENV PNPM_HOME=/pnpm CI=true
WORKDIR /src
COPY package.json ./
RUN --mount=type=secret,id=ca \
    if [ -s /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi && \
    npm install --global --no-fund --no-audit "$(node -p "require('./package.json').packageManager")"
COPY pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contract/package.json packages/contract/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=yato-pnpm,target=/pnpm/store --mount=type=secret,id=ca \
    if [ -s /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi && \
    pnpm install --frozen-lockfile --filter '@yato/web...'
COPY packages/contract/tsconfig.json packages/contract/
COPY packages/contract/src packages/contract/src
COPY apps/web/tsconfig.json apps/web/react-router.config.ts apps/web/vite.config.ts apps/web/
COPY apps/web/app apps/web/app
COPY apps/web/public apps/web/public
RUN pnpm --filter @yato/contract run build && pnpm --filter @yato/web run build
RUN --mount=type=cache,id=yato-pnpm,target=/pnpm/store --mount=type=secret,id=ca \
    if [ -s /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi && \
    pnpm --filter @yato/web deploy --prod --legacy /out && rm -rf /out/app /out/public

FROM ${RUNTIME_IMAGE}
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /out ./
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["build/server/index.js"]
