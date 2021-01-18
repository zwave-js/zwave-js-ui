# ----------------
# STEP 1:
FROM node:erbium-alpine AS build-z2m
ARG updateDevices
ARG zwavejs=https://github.com/zwave-js/node-zwave-js
# Install required dependencies
RUN apk --no-cache add \
    coreutils \
    linux-headers \
    alpine-sdk \
    python \
    openssl \
    git rsync

WORKDIR /root/zwavejs2mqtt

COPY . .
RUN npm config set unsafe-perm true
RUN npm install
RUN npm run build
RUN npm prune --production
RUN rm -rf \
    build \
    index.html \
    package-lock.json \
    package.sh \
    src \
    static \
    stylesheets
RUN if [[ ! -z "$updateDevices"  ]]; then git clone $zwavejs; \
    rsync -av node-zwave-js/packages/config/config/devices/ './node_modules/@zwave-js/config/config/devices'; \
    rm -rf node-zwave-js; fi

# ----------------
# STEP 2:
FROM node:erbium-alpine

ARG BUILD_DATE
ARG VERSION
ARG VCS_REF

RUN apk add --no-cache \
    libstdc++  \
    libgcc \
    libusb \
    tzdata \
    eudev

# Copy files from previous build stage
COPY --from=build-z2m /root/zwavejs2mqtt /usr/src/app

WORKDIR /usr/src/app

EXPOSE 8091

# Labels.
LABEL maintainer="robertsLando" \
 org.opencontainers.image.created="$BUILD_DATE" \
 org.opencontainers.image.url="https://zwave-js.github.io/zwavejs2mqtt/#/" \
 org.opencontainers.image.source="https://github.com/zwave-js/zwavejs2mqtt" \
 org.opencontainers.image.version="$VERSION" \
 org.opencontainers.image.revision="$VCS_REF" \
 org.opencontainers.image.vendor="zwave-js" \
 org.opencontainers.image.title="zwavejs2mqtt" \
 org.opencontainers.image.description="Zwave To MQTT Gateway and control panel" \
 org.opencontainers.image.documentation="https://zwave-js.github.io/zwavejs2mqtt/#/" \
 org.opencontainers.image.authors="Daniel Lando <daniel.sorridi@gmail.com>" \
 org.opencontainers.image.licenses="MIT"

CMD ["node", "bin/www"]
