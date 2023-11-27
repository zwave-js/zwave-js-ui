# Building Custom Docker Images

There are two methods to build a custom docker container, using either the project's Dockerfile or Dockerfile.contrib. While the Dockerfile method offers a faster build process, the alternative Dockerfile.contrib method allows you to specify the specific branches for node-zwave-js and zwave-js-ui, and even the ability to specify alternative repositories (such as your own).

## Building a container using Dockerfile

The docker images are the latest stable images of the [Z-Wave JS UI](https://github.com/zwave-js/zwave-js-ui) repo. If you want to keep your image updated with the latest changes you can build it on your local machine. For example:

```bash
git clone https://github.com/zwave-js/zwave-js-ui.git
cd zwave-js-ui
git checkout -b [the branch that you want]
docker build -f docker/Dockerfile -t zwavejs/zwave-js-ui:latest .
```

Build just the `build` container

```bash
docker build -f docker/Dockerfile --target=build -t zwavejs/zwave-js-ui_build .

```

## Building multi-arch containers using buildx

If you want to build multi-arch containers, you can use [buildx](https://docs.docker.com/buildx/working-with-buildx/):

```bash
# create a builder instance
docker buildx create --use
docker buildx inspect --bootstrap

# build the containers
docker buildx build \
    --platform linux/arm64,linux/amd64,linux/arm/v7 \
    -t zwavejs/zwave-js-ui:latest \
    -f docker/Dockerfile \
    .
```

## Building a container using Dockerfile.contrib

You can also build a custom docker image using any mix of branches or repositories (such as your own), simply run the following series of commands, indicating the name of the branches you wish to build for node-zwave-js (ZWJ_BRANCH) and zwave-js-ui (ZUI_BRANCH) and the resulting docker image name (e.g. zwave-js-ui):

```bash
curl -s https://raw.githubusercontent.com/zwave-js/zwave-js-ui/master/docker/Dockerfile.contrib | \
DOCKER_BUILDKIT=1 docker build - --build-arg SRC=git-clone-src --no-cache \
--build-arg ZWJ_BRANCH=master --build-arg ZUI_BRANCH=master -t zwave-js-ui
```

Alternatively, you can clone the branches locally, make any changes you like, and build a docker image from the local sources:

```bash
mkdir -p testing && cd testing
git clone https://github.com/zwave-js/node-zwave-js
git clone https://github.com/zwave-js/zwave-js-ui
## Checkout repos to any branch/commit you need to test
cd ../node-zwave-js
git checkout <branch, sha or tag>
cd zwave-js-ui
git checkout <branch, sha or tag>
cd ..
```

Then when you're ready to build run the following from the directory **above** the zwave-js-ui folder (the "testing" folder from above):

```bash
DOCKER_BUILDKIT=1 docker build --build-arg SRC=local-copy-src --no-cache -f zwave-js-ui/docker/Dockerfile.contrib -t zwave-js-ui .
```

> [!NOTE] You may optionally specify alternative repositories (such as your own) by appending
>
>`--build-arg ZWJ_REPOSITORY=https://github.com/FakeUser/node-zwave-js` or
>
>`--build-arg ZUI_REPOSITORY=https://github.com/FakeUser/zwave-js-ui`

> [!NOTE] Only BuildKit enabled builders have the capability to efficiently skip the unused source stage so it never runs.
