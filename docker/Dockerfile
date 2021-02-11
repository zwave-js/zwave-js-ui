FROM node:12.20.1-buster
# removing the dependency on fibers would mean we could go for an image without the compilers+python, also allow us to get beyond node 14
ARG updateDevices=1
ARG zwavejs=https://github.com/zwave-js/node-zwave-js/archive/master.tar.gz

WORKDIR /usr/src/app

COPY package.json ./ 
    # should really copy the package-lock.json but that is currently causing serialport to recompile
RUN npm config set unsafe-perm true
RUN npm install --no-optional
RUN if [[ ! -z "$updateDevices"  ]]; \
    then curl -sL $zwavejs | \
        tar vxz --strip=5 -C ./node_modules/@zwave-js/config/config/devices \
        node-zwave-js-master/packages/config/config/devices/ ;\
    fi
COPY . .
RUN npm run build && \
    npm prune --production

EXPOSE 8091

CMD ["node", "bin/www"]
