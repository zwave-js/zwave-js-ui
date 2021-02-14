# Purpose: Building zwavejs2mqtt using the prepared base image that already includes all dependencies
ARG BUILDER_BASE_IMAGE_TAG=latest
FROM zwavejs/zwavejs2mqtt-builder-base:${BUILDER_BASE_IMAGE_TAG}

# when update devices arg is set update config files from zwavejs repo
ARG updateDevices
ARG zwavejs=https://github.com/zwave-js/node-zwave-js/archive/master.tar.gz

RUN if [ ! -z "$updateDevices"  ]; \
  then curl -sL ${zwavejs} | \
  tar vxz --strip=5 -C ./node_modules/@zwave-js/config/config/devices \
  node-zwave-js-master/packages/config/config/devices/ ;\
  fi

COPY . .

RUN npm run build

# TODO: Verify if all entries are really required here:
RUN rm -rf \
  build \
  index.html \
  src \
  static \
  stylesheets
