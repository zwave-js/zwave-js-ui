ARG image=zwave-js-ui

FROM alpine:3.18.4 as base

RUN apk add --no-cache \
    openssl \
    libusb \
    tzdata \
    eudev \
    nodejs=18.18.2-r0

WORKDIR /usr/src/app

# STEP: 1 build
FROM base AS build-zui

RUN apk --no-cache add \
    jq make gcc g++ python3 linux-headers \
    npm=9.6.6-r0
    
RUN npm install --global yarn@2.4.3

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases

ENV YARN_HTTP_TIMEOUT=300000
# set production env install will not install devDependencies
ENV NODE_ENV=production

ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY . .

# if node_modules does not exist, run it, otherwise skip
RUN [ -d 'node_modules' ] && echo "Skipping install" || yarn install --immutable

# Fix issue with serialport bindings #2349
RUN npm_config_build_from_source=true npm rebuild @serialport/bindings-cpp

# Build back and frontend only when not existing
RUN [ -d 'dist' ] && echo "Skipping build" || yarn build

RUN yarn remove $(cat package.json | jq -r '.devDependencies | keys | join(" ")') && \
    rm -rf \
    build \
    package.sh \
    src \
    static \
    docs \
    .yarn \
    .github \
    .vscode

# add plugin support, space separated
ARG plugins
RUN if [ ! -z "$plugins" ]; \
    then echo "Installing plugins ${plugins}"; yarn add ${plugins} ; fi

# when update devices arg is set update config files from zwavejs repo
ARG updateDevices
ARG zwavejs=https://github.com/zwave-js/node-zwave-js/archive/master.tar.gz

RUN if [ ! -z "$updateDevices"  ]; \
    then curl -sL ${zwavejs} | \
    tar vxz --strip=5 -C ./node_modules/@zwave-js/config/config/devices \
    node-zwave-js-master/packages/config/config/devices/ ;\
    fi

# STEP: 2 (runtime)
FROM base AS runtime

# Copy files from previous build stage
COPY --from=build-zui /usr/src/app /usr/src/app

ENV ZWAVEJS_EXTERNAL_CONFIG=/usr/src/app/store/.config-db

ENV TAG_NAME=${image_name}

ENV NODE_ENV=production

EXPOSE 8091

CMD ["node", "server/bin/www"]
