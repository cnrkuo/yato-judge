ARG NODE_IMAGE=docker.io/library/node:26-trixie
FROM ${NODE_IMAGE}
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true \
    npm_config_store_dir=/workspace/node_modules/.pnpm-store
ENV NODE_EXTRA_CA_CERTS=/etc/yato-dev/extra-ca.pem
COPY package.json /tmp/package.json
RUN --mount=type=secret,id=ca \
    mkdir -p /etc/yato-dev && cat /run/secrets/ca > /etc/yato-dev/extra-ca.pem 2>/dev/null || : ; \
    NODE_EXTRA_CA_CERTS=/etc/yato-dev/extra-ca.pem npm install --global --no-fund --no-audit \
      "$(node -p "require('/tmp/package.json').packageManager")"
RUN mkdir -p /workspace/node_modules /workspace/packages/contract/node_modules \
      /workspace/apps/api/node_modules /workspace/apps/web/node_modules && \
    chown -R node:node /workspace
WORKDIR /workspace
