ARG image=zwave-js-ui

# STEP: 1 build
FROM node:18.14.2-alpine3.16 AS build-zui

WORKDIR /usr/src/app

RUN apk --no-cache add \
    coreutils \
    jq \
    linux-headers \
    alpine-sdk \
    python3

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases .yarn/releases

ENV YARN_HTTP_TIMEOUT=300000
# set production env install will not install devDependencies
ENV NODE_ENV=production

COPY . .

# if node_modules does not exist, run it, otherwise skip
RUN [ -d 'node_modules' ] && echo "Skipping install" || yarn install --immutable

# Fix issue with serialport bindings #2349
RUN npm_config_build_from_source=true yarn rebuild @serialport/bindings-cpp

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
FROM node:18.14.2-alpine3.16

RUN apk add --no-cache \
    libstdc++ \
    openssl \
    libgcc \
    libusb \
    tzdata \
    eudev


# Copy files from previous build stage
COPY --from=build-zui /usr/src/app /usr/src/app

ENV ZWAVEJS_EXTERNAL_CONFIG=/usr/src/app/store/.config-db

ENV TAG_NAME=${image_name}

ENV NODE_ENV=production

WORKDIR /usr/src/app

EXPOSE 8091

CMD ["node", "server/bin/www"]
