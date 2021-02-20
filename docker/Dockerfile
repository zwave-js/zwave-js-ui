# STEP: 1
FROM node:erbium-buster-slim AS build-z2m

WORKDIR /usr/src/app

RUN apk --no-cache add \
    coreutils \	
    linux-headers \
    alpine-sdk \	
    python

COPY package.json package-lock.json ./ 

RUN npm config set unsafe-perm true
RUN npm install --no-optional

# when update devices arg is set update config files from zwavejs repo
ARG updateDevices
ARG zwavejs=https://github.com/zwave-js/node-zwave-js/archive/master.tar.gz

RUN if [ ! -z "$updateDevices"  ]; \
    then curl -sL ${zwavejs} | \
        tar vxz --strip=5 -C ./node_modules/@zwave-js/config/config/devices \
        node-zwave-js-master/packages/config/config/devices/ ;\
    fi

COPY . .

RUN npm run build && \
    npm prune --production && \
    rm -rf \
        build \
        index.html \
        package-lock.json \
        package.sh \
        src \
        static \
        stylesheets

# STEP: 2 (runtime)
FROM node:erbium-buster-slim

RUN apk add --no-cache \	
    libstdc++  \	
    libgcc \	
    libusb \	
    tzdata \	
    eudev	

# Copy files from previous build stage	
COPY --from=build-z2m /usr/src/app /usr/src/app	

WORKDIR /usr/src/app

EXPOSE 8091

CMD ["node", "bin/www"]
