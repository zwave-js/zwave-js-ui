# syntax=docker/dockerfile:1
ARG image=zwave-js-ui
ARG NODE_VERSION=22.20.0
ARG ALPINE_VERSION=3.22
ARG BUILDPLATFORM

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

# STEP: 1 - Build JS/TS artifacts once on native amd64 (dist/ and server/ are platform-agnostic)
FROM --platform=$BUILDPLATFORM base AS build-js

RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add --virtual .build-dependencies \
        jq \
        build-base \
        linux-headers \
        python3-dev

# Cache dependency layer independently of source changes
COPY --link package.json package-lock.json patches/ ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source and build (only these layers re-run on source-only changes)
COPY --link . .
RUN npm run build

RUN apk del .build-dependencies

# STEP: 2 - Install platform-specific production dependencies and native addons
FROM base AS build-native

RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add --virtual .build-dependencies \
        jq \
        build-base \
        linux-headers \
        python3-dev

COPY --link package.json package-lock.json patches/ ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Fix issue with serialport bindings #2349
RUN npm_config_build_from_source=true npm rebuild @serialport/bindings-cpp

# Copy platform-agnostic build artifacts from build-js
COPY --link --from=build-js /usr/src/app/dist ./dist
COPY --link --from=build-js /usr/src/app/server ./server
COPY --link snippets ./snippets

# add plugin support, space separated
ARG plugins
RUN --mount=type=cache,target=/root/.npm \
    if [ ! -z "$plugins" ]; \
    then echo "Installing plugins ${plugins}"; npm install ${plugins} ; fi

# when update devices arg is set update config files from zwavejs repo
ARG updateDevices
ARG zwavejs=https://github.com/zwave-js/node-zwave-js/archive/master.tar.gz

RUN if [ ! -z "$updateDevices" ]; \
    then curl -sL ${zwavejs} | \
    tar vxz --strip=5 -C ./node_modules/@zwave-js/config/config/devices \
    node-zwave-js-master/packages/config/config/devices/ ; \
    fi

RUN apk del .build-dependencies

# STEP: 3 (runtime)
FROM base AS runtime

# Copy files from previous build stage
COPY --link --from=build-native /usr/src/app /usr/src/app

ENV TAG_NAME=${image}

ENV NODE_ENV=production

EXPOSE 8091

CMD ["node", "server/bin/www"]
