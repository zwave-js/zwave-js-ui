#!/usr/bin/env bash
set -e

ask() {
	# http://djm.me/ask
	while true; do

		if [ "${2:-}" = "Y" ]; then
			prompt="Y/n"
			default=Y
		elif [ "${2:-}" = "N" ]; then
			prompt="y/N"
			default=N
		else
			prompt="y/n"
			default=
		fi

		# Ask the question
		read -p "$1 [$prompt] " REPLY

		# Default?
		if [ -z "$REPLY" ]; then
			REPLY=$default
		fi

		# Check if the reply is valid
		case "$REPLY" in
			Y*|y*) return 0 ;;
			N*|n*) return 1 ;;
		esac

	done
}

pkg() {
	echo "Executing command: npx pkg $@"
	npx pkg $@
}

APP=$(node -p "require('./package.json').name")
PKG_FOLDER="pkg"

echo "Destination folder: $PKG_FOLDER"
echo "App-name: $APP"

VERSION=$(node -p "require('./package.json').version")
echo "Version: $VERSION"

NODE_MAJOR=$(node -v | grep -E -o '[0-9].' | head -n 1)

echo "## Clear $PKG_FOLDER folder"
rm -rf $PKG_FOLDER/*

# if --arch is passed as argument, use it as value for ARCH
if [[ "$@" == *"--arch"* ]]; then
	ARCH=$(echo "$@" | grep -oP '(?<=--arch=)[^ ]+')
else
	ARCH=$(uname -m)
fi

echo "## Architecture: $ARCH"

if [ ! -z "$1" ]; then
	echo "## Building application..."
	echo ''

	# skip build if args contains --skip-build
	if [[ "$@" != *"--skip-build"* ]]; then
		npm run build
	else
		echo "## Skipping build..."
	fi

	# if --bundle is passed as argument, cd to `build` folder
	if [[ "$@" == *"--bundle"* ]]; then
		echo "## Building bundle..."
		echo ''
		npm run bundle
		echo "## Changing directory to build folder"
		cd build
	fi

	if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
		pkg package.json -t node$NODE_MAJOR-linux-arm64 --out-path $PKG_FOLDER
	elif [ "$ARCH" = "armv7" ]; then
		pkg package.json -t node$NODE_MAJOR-linux-armv7 --out-path $PKG_FOLDER --public-packages=*
	else
		pkg package.json -t node$NODE_MAJOR-linux-x64,node$NODE_MAJOR-win-x64  --out-path $PKG_FOLDER
	fi

else

	if ask "Re-build $APP?"; then
		echo "## Building application"
		npm run build
	fi

	echo '###################################################'
	echo '## Choose architecture to build'
	echo '###################################################'
	echo ' '
	echo 'Your architecture is' $ARCH
	PS3="Architecture: >"
	options=(
		"x64"
		"armv7"
		"armv6"
		"x86"
		"alpine"
		"arm64"
	)
	echo ''
	select option in "${options[@]}"; do
		case "$REPLY" in
			1)
				echo "## Creating application package in $PKG_FOLDER folder"
				pkg package.json -t node$NODE_MAJOR-linux-x64 --out-path $PKG_FOLDER
				break
				;;
			2)
				echo "## Creating application package in $PKG_FOLDER folder"
				pkg package.json -t node$NODE_MAJOR-linux-armv7 --out-path $PKG_FOLDER --public-packages=*
				break
				;;
			3)
				echo "## Creating application package in $PKG_FOLDER folder"
				pkg package.json -t node$NODE_MAJOR-linux-armv6 --out-path $PKG_FOLDER --public-packages=*
				break
				;;
			4)
				echo "## Creating application package in $PKG_FOLDER folder"
				pkg package.json -t node$NODE_MAJOR-linux-x86 --out-path $PKG_FOLDER
				break
				;;
			5)
				echo "## Creating application package in $PKG_FOLDER folder"
				pkg package.json -t node$NODE_MAJOR-alpine-x64 --out-path $PKG_FOLDER
				break
				;;
			6)
				echo "## Creating application package in $PKG_FOLDER folder"
				pkg package.json -t node$NODE_MAJOR-linux-arm64 --out-path $PKG_FOLDER --public-packages=*
				break
				;;
			*)
				echo '####################'
				echo '## Invalid option ##'
				echo '####################'
				exit
		esac
	done
fi

echo "## Create folders needed"
cd $PKG_FOLDER
mkdir store -p

if [ ! -z "$1" ]; then

	if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
		echo "## Create zip file $APP-v$VERSION-linux-arm64"
		zip -r $APP-v$VERSION-linux-arm64.zip store $APP
	elif [ "$ARCH" = "armv7" ]; then
		echo "## Create zip file $APP-v$VERSION-linux-armv7"
		zip -r $APP-v$VERSION-linux-armv7.zip store $APP
	else
		echo "## Create zip file $APP-v$VERSION-win"
		zip -r $APP-v$VERSION-win.zip store $APP-win.exe

		echo "## Create zip file $APP-v$VERSION-linux"
		zip -r $APP-v$VERSION-linux.zip store $APP-linux
	fi

else
	echo "## Create zip file $APP-v$VERSION"
	zip -r $APP-v$VERSION.zip store $APP
fi
