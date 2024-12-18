ARG image=zwave-js-ui

FROM alpine:3.21.0 AS base

RUN apk add --no-cache \
    openssl \
    libusb \
    tzdata \
    eudev \
    nodejs=22.11.0-r0

# https://pkgs.alpinelinux.org/packages?name=nodejs&branch=edge&repo=&arch=&maintainer=

WORKDIR /usr/src/app

# STEP: 1 build
FROM base AS build-zui

RUN \
    apk add --no-cache --virtual .build-dependencies \
        jq \
        build-base \
        linux-headers \
        python3-dev \
        npm=10.9.1-r0

COPY . .

# if node_modules does not exist, install deps, if dist is missing, install also dev deps
RUN [ -d 'node_modules' ] && echo "Skipping install" || npm ci $([ -d 'dist' ] && echo '--omit=dev' || echo '')

# Fix issue with serialport bindings #2349
RUN npm_config_build_from_source=true npm rebuild @serialport/bindings-cpp

# Build back and frontend only when not existing
RUN [ -d 'dist' ] && echo "Skipping build" || npm run build

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

RUN apk del --no-cache --purge .build-dependencies

# STEP: 2 (runtime)
FROM base AS runtime

# Copy files from previous build stage
COPY --from=build-zui /usr/src/app /usr/src/app

ENV TAG_NAME=${image}

ENV NODE_ENV=production

EXPOSE 8091

CMD ["node", "server/bin/www"]
