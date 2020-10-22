# ----------------
# STEP 1:
FROM node:erbium-alpine AS build-z2m

# Install required dependencies
RUN apk --no-cache add \
    coreutils \
    linux-headers \
    alpine-sdk \
    python \
    openssl

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
COPY --from=build-z2m /root/zwavejs2mqtt /usr/src/app

# Set enviroment
ENV LD_LIBRARY_PATH /lib

WORKDIR /usr/src/app

EXPOSE 8091

CMD ["node", "bin/www"]
