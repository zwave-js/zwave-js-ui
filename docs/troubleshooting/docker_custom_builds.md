# Docker custom builds

If you are using docker and you need to test a new feature that isn't on master of both zwavejs2mqtt and zwave-js repos you will need to create a custom docker build. To do this you can use the file `docker/Dockerfile.contrib`.

This is typically used to build zwavejs2mqtt from git with a version of zwave-js also from git, for instance the latest master or a branch.

## Prerequisites

In order to build it you first need the source code from github.

```bash
mkdir -p testing && cd testing
git clone https://github.com/zwave-js/node-zwave-js
git clone https://github.com/zwave-js/zwavejs2mqtt
## Checkout repos to any branch/commit you need to test
cd zwavejs2mqtt
git checkout <branch, sha or tag>
cd ../node-zwave-js
git checkout <branch, sha or tag>
cd ..
```

## Build

Run the build from outside the two repo folders:

```bash
DOCKER_BUILDKIT=1 docker build --build-arg SRC=git-clone-src --build-arg Z2M_BRANCH=master --build-arg ZWJ_BRANCH=master --no-cache -f zwavejs2mqtt/docker/Dockerfile.contrib -t zwavejs2mqtt .
```

or

```bash
DOCKER_BUILDKIT=1 docker build --build-arg SRC=local-copy-src --no-cache -f zwavejs2mqtt/docker/Dockerfile.contrib -t zwavejs2mqtt .
```

> [!NOTE]
> Only BuildKit enabled builders have the capability to efficiently skip the unused source stage so it never runs.
