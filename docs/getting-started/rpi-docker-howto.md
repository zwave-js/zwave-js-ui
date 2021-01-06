# Introduction
This how gives steps to getting docker and zwavejs2mqtt working on a raspbery pi 4.

In this example I am using a zwave hat on the pi, this will make it use /dev/ttyAMA0.  If you use a USB zwave module your device will be be something like /dev/ttyUSB01, change your serial port as appropriate.

# Prepare Raspberry Pi
Fit raZberry hat to pi, then plug in power
Image Raspbian image and boot and logon (if you don't know how to do this, go find a pi and linux tutorial)
login

	• sudo apt update
	• sudo apt upgrade
	
# Disable Bluetooth on pi4
 only needed if using pihat, see here for detailed why https://di-marco.net/blog/it/2020-06-06-paspberry_pi_3_4_and_0_w_serial_port_usage/
 `sudo nano /boot/config.txt`
 add following and save and exit
 `# Disable Bluetooth
 dtoverlay=disable-bt
	
# Install docker
	• curl -fsSL https://get.docker.com -o get-docker.sh
	• sudo sh get-docker.sh
	• sudo usermod -aG docker pi
	• sudo apt install python3 
	• sudo apt install python3.pip
	• sudo pip3 -v install docker-compose  (is the -v really needed?)

Optional (don't do unless you have an issue)
	• wget -q -O - https://razberry.z-wave.me/install | sudo bash
	• This installed a bunch of stuff like avahai, libssl etc by script, unknown if this is needed as when I uninstalled none of those thigs were wiped out, only install this if a)you get an issue error with docker or b)you might need this to initialize the raZberry zwave module.
	• Later clarification - I looked at script and uninstalled everything it installed and all seems ok, so this section is not needed.

Configure docker and zwave2mqtt container

	• mkdir zwavejs2mqtt
	• cd zwavejs2mqtt
	• curl -fsSL https://raw.githubusercontent.com/OpenZwave/Zwave2Mqtt/master/docker/docker-compose.yml -o docker-compose.yml
	• nano docker-compose.yml
		○ Change serial in devices to correct serial port (e.g. ttyAMA0
		○ Add folloing to voumes:  - ./openzwave:/usr/local/etc/openzwave
		○ Exit nano and save
	• Copy open zwave database to enable updates to be be persistent
		○  APP=$(docker run --rm -it -d robertslando/zwave2mqtt:latest)
		○ docker cp $APP:/usr/local/etc/openzwave ./
		○  docker kill $APP
	• Sudo docker-compose up -d
	

Configure zwavejs2mqtt
Configure Zwave

The following fields need to be filled:
	• Serial port with your serial port path inside the container - e.g /dev/ttyAMA0
	• Auto Update database = on (it is off by default)
	• Poll interval 1000ms (aka 1s)
	• Command timeout 20 seconds
	• Optionally fill in your desire network key (make one up)
	• Don't forget to click save

If this is done right after a few mins when you return to the main page the HomeID and Home Hex should be populated.

Configure MQTT
Assumes you are already running an MQTT container like the one in home assistant supervisor mode or mosquitto from docker

TODO (waiting on seeming issues with raZberry module on reboots……
