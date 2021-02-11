FROM node:erbium-alpine AS build-z2m
# removing the dependency on fibers would mean we could go for an image without the compilers+python, also allow us to get beyond node 14
ARG updateDevices
ARG zwavejs=https://github.com/zwave-js/node-zwave-js/archive/master.tar.gz

WORKDIR /usr/src/app

COPY package.json ./ 
    # should really copy the package-lock.json but that is currently causing serialport to recompile
RUN npm config set unsafe-perm true
RUN npm install --no-optional
RUN if [ ! -z "$updateDevices"  ]; \
    then curl -sL ${zwavejs} | \
        tar vxz --strip=5 -C ./node_modules/@zwave-js/config/config/devices \
        node-zwave-js-master/packages/config/config/devices/ ;\
    fi
COPY . .
RUN npm run build && \
    npm prune --production

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
