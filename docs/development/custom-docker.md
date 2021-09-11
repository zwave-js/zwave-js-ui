# Building Custom Docker Images

There are two methods to build a custom docker container, using either the project's Dockerfile or Dockerfile.contrib. While the Dockerfile method offers a faster build process, the alternative Dockerfile.contrib method allows you to specify the specific branches for node-zwave-js and ZWavejs2Mqtt, and even the ability to specify alternative repositories (such as your own).

## Building a container using Dockerfile

The docker images are the latest stable images of the [ZWavejs2Mqtt](https://github.com/zwave-js/zwavejs2mqtt) repo. If you want to keep your image updated with the latest changes you can build it on your local machine. For example:

```bash
git clone https://github.com/zwave-js/zwavejs2mqtt.git
cd zwavejs2mqtt
git checkout -b [the branch that you want]
docker build -f docker/Dockerfile -t zwavejs/zwavejs2mqtt:latest .
```

Build just the `build` container

```bash
docker build -f docker/Dockerfile --target=build -t zwavejs/zwavejs2mqtt_build .

```

## Building a container using Dockerfile.contrib

You can also build a custom docker image using any mix of branches or repositories (such as your own), simply run the following series of commands, indicating the name of the branches you wish to build for node-zwave-js (ZWJ_BRANCH) and ZWavejs2Mqtt (Z2M_BRANCH) and the resulting docker image name (e.g. zwavejs2mqtt):

```bash
curl -s https://raw.githubusercontent.com/zwave-js/zwavejs2mqtt/master/docker/Dockerfile.contrib | \
DOCKER_BUILDKIT=1 docker build - --build-arg SRC=git-clone-src --no-cache \
--build-arg ZWJ_BRANCH=master --build-arg Z2M_BRANCH=master -t zwavejs2mqtt
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

Then when you're ready to build run the following from the directory **above** the ZWavejs2Mqtt folder (the "testing" folder from above):

```bash
DOCKER_BUILDKIT=1 docker build --build-arg SRC=local-copy-src --no-cache -f zwavejs2mqtt/docker/Dockerfile.contrib -t zwavejs2mqtt .
```

> [!NOTE] You may optionally specify alternative repositories (such as your own) by appending
>
>`--build-arg ZWJ_REPOSITORY=https://github.com/FakeUser/node-zwave-js` or
>
>`--build-arg Z2M_REPOSITORY=https://github.com/FakeUser/zwavejs2mqtt`

> [!NOTE] Only BuildKit enabled builders have the capability to efficiently skip the unused source stage so it never runs.
