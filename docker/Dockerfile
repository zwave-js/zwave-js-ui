# syntax=docker/dockerfile:1
ARG image=zwave-js-ui
# Full image refs, one per ARG: Renovate rewrites the ARG line that holds the whole
# ref, so a shared version fragment gets the digest of only one of the two images.
# Keep the -alpine suffix here in sync with ALPINE_IMAGE.
ARG NODE_IMAGE=node:24.22.0-alpine3.23
ARG ALPINE_IMAGE=alpine:3.23
ARG BUILDPLATFORM
ARG TARGETARCH

FROM ${NODE_IMAGE} AS node

FROM ${ALPINE_IMAGE} AS alpine

RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add \
    openssl \
    libusb \
    tzdata \
    eudev

WORKDIR /usr/src/app

# 64-bit arches: official Node binaries, version pinned by NODE_IMAGE
FROM alpine AS node-official

COPY --link --from=node /usr/lib /usr/lib
COPY --link --from=node /usr/local/lib /usr/local/lib
COPY --link --from=node /usr/local/include /usr/local/include
COPY --link --from=node /usr/local/bin /usr/local/bin

# 32-bit ARM: Node.js ships no armv6/armv7 binaries from v24 on (#4755), so use
# whatever Node the Alpine release ships. nodejs-dev gives node-gyp the headers the
# official image has in /usr/local/include, so it doesn't fetch them from nodejs.org.
FROM alpine AS node-apk

RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add \
    nodejs \
    nodejs-dev \
    npm

FROM node-official AS base-amd64
FROM node-official AS base-arm64
FROM node-apk AS base-arm

FROM base-${TARGETARCH} AS base

# STEP: 1 - Build JS/TS artifacts once on native amd64 (dist/ and server/ are platform-agnostic)
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build-js

WORKDIR /usr/src/app

RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add --virtual .build-dependencies \
        jq \
        build-base \
        linux-headers \
        python3-dev

# Cache dependency layer independently of source changes
COPY --link package.json package-lock.json ./
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

COPY --link package.json package-lock.json ./
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
