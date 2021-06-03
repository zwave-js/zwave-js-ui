#!/bin/sh

# dialout group grants access to /dev/ttyACM# devices
addgroup node dialout

# reset ownership of store for prior runs as root
chown -R node:node /usr/src/app/store

# run the app as node user
exec su -p node -c "node bin/www"
