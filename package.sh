#!/bin/bash

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

APP="zwave2mqtt"
PKG_FOLDER="pkg"

echo "Destination folder: $PKG_FOLDER"
echo "App-name: $APP"

VERSION=$(node -p "require('./package.json').version")
echo "Version: $VERSION"

echo "## Clear $PKG_FOLDER folder"
rm -rf $PKG_FOLDER/*

if ask "Re-build $APP?"; then
  echo "## Building application"
  npm run build
fi

echo '###################################################'
echo '## Choose architecture to build'
echo '###################################################'
echo ' '
echo 'Your architecture is' $(arch)
PS3="Architecture: >"
options=(
	"x64"
	"armv7"
	"armv6"
	"x86"
)
echo ''
select option in "${options[@]}"; do
	case "$REPLY" in
		1)
			echo "## Creating application package in $PKG_FOLDER folder"
			sudo pkg package.json -t node8-linux-x64 --out-path $PKG_FOLDER
			break
			;;
		2)
			echo "## Creating application package in $PKG_FOLDER folder"
			sudo pkg package.json -t node8-linux-armv7 --out-path $PKG_FOLDER --public-packages=*
			break
			;;
		3)
			echo "## Creating application package in $PKG_FOLDER folder"
			sudo pkg package.json -t node8-linux-armv6 --out-path $PKG_FOLDER --public-packages=*
			break
			;;
		4)
			echo "## Creating application package in $PKG_FOLDER folder"
			sudo pkg package.json -t node8-linux-x86 --out-path $PKG_FOLDER
			break
			;;
		*)
			echo '####################'
			echo '## Invalid option ##'
			echo '####################'
			exit
	esac
done

echo "## Check for .node files to include in executable folder"
declare TO_INCLUDE=($(find ./node_modules/ -type f -name "*.node"))

TOTAL_INCLUDE=${#TO_INCLUDE[@]}

echo "## Found $TOTAL_INCLUDE files to include"

i=0

while [ "$i" -lt "$TOTAL_INCLUDE" ]
do
  IFS='/' path=(${TO_INCLUDE[$i]})
  file=${path[-1]}
  echo "## Copying $file to $PKG_FOLDER folder"
  cp "${TO_INCLUDE[$i]}" "./$PKG_FOLDER"
  let "i = $i + 1"
done

echo "## Create folders needed (backups, logs and icons) and copy widgets lib"
cd $PKG_FOLDER
mkdir store -p
echo "## Create zip file $APP-v$VERSION"
zip -r $APP-v$VERSION.zip *
