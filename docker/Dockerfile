# ----------------
# STEP 1:
FROM node:erbium-alpine AS build

ARG OPENZWAVE_GIT_SHA1=master

# Install required dependencies
RUN apk --no-cache add \
    eudev-dev \
    coreutils \
    linux-headers \
    alpine-sdk \
    python \
    openssl

WORKDIR /root

# need to get the full repo so that the build can reference git sha etc
RUN git clone https://github.com/OpenZWave/open-zwave.git 

WORKDIR /root/open-zwave
RUN git checkout ${OPENZWAVE_GIT_SHA1}
RUN make install

WORKDIR /root/Zwave2Mqtt
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
    stylesheets \
    views 

# ----------------
# STEP 2:
FROM node:erbium-alpine

LABEL maintainer="robertsLando"

RUN apk add --no-cache \
    libstdc++  \
    libgcc \
    libusb \
    tzdata \
    eudev

# Copy files from previous build stage
COPY --from=build /root/open-zwave/libopenzwave.so* /lib/
COPY --from=build /root/open-zwave/config /usr/local/etc/openzwave
COPY --from=build /root/Zwave2Mqtt /usr/src/app

# Set enviroment
ENV LD_LIBRARY_PATH /lib

WORKDIR /usr/src/app

EXPOSE 8091

CMD ["node", "bin/www"]
