# STEP: 1
FROM node:erbium-alpine AS build-z2m

ARG updateDevices
ARG zwavejs=https://github.com/zwave-js/node-zwave-js/archive/master.tar.gz

WORKDIR /usr/src/app

COPY package.json package-lock.json ./ 

RUN npm config set unsafe-perm true
RUN npm install --no-optional
RUN if [ ! -z "$updateDevices"  ]; \
    then curl -sL ${zwavejs} | \
        tar vxz --strip=5 -C ./node_modules/@zwave-js/config/config/devices \
        node-zwave-js-master/packages/config/config/devices/ ;\
    fi

COPY . .

RUN npm run build

RUN npm prune --production

# STEP: 2
FROM node:erbium-alpine	

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
