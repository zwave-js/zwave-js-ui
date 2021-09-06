# Docker custom builds

If you are using docker and you need to test a new feature that isn't on master of both zwavejs2mqtt and zwave-js repos you will need to create a custom docker build. To do this you can use the file `docker/Dockerfile.contrib`.

This is typically used to build zwavejs2mqtt while mixing branches from zwave-js and zwavejs2mqtt.

## Building a custom docker image

To build a custom docker image, simply run the following series of commands, indicating the name of the branches you wish to build for node-zwave-js (ZWJ_BRANCH) and zwavejs2mqtt (Z2M_BRANCH) and the resulting docker image name (e.g. zwavejs/custom_zwavejs2mqtt):

```bash
curl -s https://raw.githubusercontent.com/zwave-js/zwavejs2mqtt/master/docker/Dockerfile.contrib | \
DOCKER_BUILDKIT=1 docker build - --build-arg SRC=git-clone-src --no-cache \
--build-arg ZWJ_BRANCH=master --build-arg Z2M_BRANCH=master -t zwavejs/custom_zwavejs2mqtt
```

Alternatively, you can clone the branches locally, make any changes you like, and build a docker image from the local sources:

```bash
mkdir -p testing && cd testing
git clone https://github.com/zwave-js/node-zwave-js
git clone https://github.com/zwave-js/zwavejs2mqtt
## Checkout repos to any branch/commit you need to test
cd ../node-zwave-js
git checkout <branch, sha or tag>
cd zwavejs2mqtt
git checkout <branch, sha or tag>
cd ..
```

Then when you're ready to build run the following from the directory *above* the zwavejs2mqtt folder (the "testing" folder from above):

```bash
DOCKER_BUILDKIT=1 docker build --build-arg SRC=local-copy-src --no-cache -f zwavejs2mqtt/docker/Dockerfile.contrib -t zwavejs/custom_zwavejs2mqtt .
```

> [!NOTE] You may optionally specify alternative repositories (such as your own) by appending

`--build-arg ZWJ_REPOSITORY=https://github.com/FakeUser/node-zwave-js` or

`--build-arg Z2M_REPOSITORY=https://github.com/FakeUser/zwavejs2mqtt`

> [!NOTE] Only BuildKit enabled builders have the capability to efficiently skip the unused source stage so it never runs.
