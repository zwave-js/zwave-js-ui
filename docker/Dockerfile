# syntax=docker/dockerfile:1
ARG image=zwave-js-ui
ARG NODE_VERSION=22.20.0
ARG ALPINE_VERSION=3.22

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS node

FROM alpine:${ALPINE_VERSION} AS base

RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add \
    openssl \
    libusb \
    tzdata \
    eudev

COPY --link --from=node /usr/lib /usr/lib
COPY --link --from=node /usr/local/lib /usr/local/lib
COPY --link --from=node /usr/local/include /usr/local/include
COPY --link --from=node /usr/local/bin /usr/local/bin

# https://pkgs.alpinelinux.org/packages?name=nodejs&branch=edge&repo=&arch=&maintainer=

WORKDIR /usr/src/app

# STEP: 1 build
FROM base AS build-zui

RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add --virtual .build-dependencies \
        jq \
        build-base \
        linux-headers \
        python3-dev

# Cache dependency layer independently of source changes
COPY --link package.json package-lock.json patches/ ./
RUN npm ci
# Fix issue with serialport bindings #2349
RUN npm_config_build_from_source=true npm rebuild @serialport/bindings-cpp

# Copy source and build (only these layers re-run on source-only changes)
COPY --link . .
RUN npm run build

RUN npm prune --omit=dev && \
    find . -mindepth 1 -maxdepth 1 \
    ! -name "node_modules" \
    ! -name "snippets" \
    ! -name ".git" \
    ! -name "package.json" \
    ! -name "server" \
    ! -name "dist" \
    -exec rm -rf {} +

# add plugin support, space separated
ARG plugins
RUN if [ ! -z "$plugins" ]; \
    then echo "Installing plugins ${plugins}"; npm install ${plugins} ; fi

# when update devices arg is set update config files from zwavejs repo
ARG updateDevices
ARG zwavejs=https://github.com/zwave-js/node-zwave-js/archive/master.tar.gz

RUN if [ ! -z "$updateDevices"  ]; \
    then curl -sL ${zwavejs} | \
    tar vxz --strip=5 -C ./node_modules/@zwave-js/config/config/devices \
    node-zwave-js-master/packages/config/config/devices/ ;\
    fi

RUN apk del .build-dependencies

# STEP: 2 (runtime)
FROM base AS runtime

# Copy files from previous build stage
COPY --link --from=build-zui /usr/src/app /usr/src/app

ENV TAG_NAME=${image}

ENV NODE_ENV=production

EXPOSE 8091

CMD ["node", "server/bin/www"]
