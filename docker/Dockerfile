# STEP: 1 doens't work with alpine 3.13+
FROM node:16.3.0-alpine3.12 AS build-z2m

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

RUN yarn install --immutable

# Fix issue with serialport bindings #2349
RUN npm_config_build_from_source=true yarn rebuild @serialport/bindings-cpp

COPY . .

RUN yarn run build && \
    yarn remove $(cat package.json | jq -r '.devDependencies | keys | join(" ")') && \
    rm -rf \
    build \
    package.sh \
    src \
    static \
    docs \
    .yarn

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

# STEP: 2 (runtime) doens't work with alpine 3.13+
FROM node:16.3.0-alpine3.12

RUN apk add --no-cache \	
    libstdc++ \
    openssl \
    libgcc \	
    libusb \	
    tzdata \	
    eudev \
    git


# Copy files from previous build stage	
COPY --from=build-z2m /usr/src/app /usr/src/app

ENV ZWAVEJS_EXTERNAL_CONFIG=/usr/src/app/store/.config-db

WORKDIR /usr/src/app

EXPOSE 8091

CMD ["node", "server/bin/www"]
