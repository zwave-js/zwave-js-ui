# Introduction
This how gives steps to getting docker and zwavejs2mqtt working on a raspbery pi 4.

Assumtions in this example:
1. I am using a RazBerry zwave pi-hat - this will use /dev/ttyAMA0, if using a USB change serial port as needed in files and commands
2. This is a dedicated z-wave node not running anything else
3. I want the UI on port 80 so i don't have to put port numbers in my browser (i am lazy)

# Prepare Raspberry Pi
## Basci setup
Fit raZberry hat to pi, then plug in power
Image Raspbian image and boot and logon (if you don't know how to do this, go find a pi and linux tutorial)
login

	sudo apt update
	sudo apt upgrade

## Give your pi a friendly name
use raspi-config to set name to something like pi-zwave01

 	choose option 1 system options
 	choose option S4 Hostname
don't forget to save as you backout of the menus
> Note: latest raspbian has avahai loaded by default which has mDNS enabled; meaning you can address your pi as http://pi-zwave01 rather than using IP address if your client is mDNS aware without needing to make a DNS entry in your router/dns server.  

## Disable Bluetooth on pi4
 only needed if using pihat, see here for detailed why https://di-marco.net/blog/it/2020-06-06-paspberry_pi_3_4_and_0_w_serial_port_usage/
 
 	sudo nano /boot/config.txt
 
 add following and save and exit
 
	# Disable Bluetooth
	dtoverlay=disable-bt
	
# Install docker
	cd ~
 	curl -fsSL https://get.docker.com -o get-docker.sh
 	sudo sh get-docker.sh
 	sudo usermod -aG docker pi
 	sudo apt install python3 
 	sudo apt install python3.pip
 	sudo pip3 -v install docker-compose  (is the -v really needed?)

# Configure zwave2mqtt container

	cd ~
 	mkdir zwavejs2mqtt
	cd zwavejs2mqtt
	curl -fsSL https://raw.githubusercontent.com/OpenZwave/Zwave2Mqtt/master/docker/docker-compose.yml -o docker-compose.yml
	nano docker-compose.yml
		○ Change serial in devices to correct serial port (e.g. /dev/ttyAMA0)
		○ Change port to 80:8091 (optional, but rest of example assumes this change was made)
		○ Exit nano and save
	Sudo docker-compose up -d
	
# Configure zwavejs2mqtt
Connect to http://pi-zwave01
click the cog 
click zwave

The following fields need to be filled:
	• Serial port with your serial port path inside the container - e.g /dev/ttyAMA0
	• Poll interval 1000ms (aka 1s)
	• Commands timeout 20 seconds
	• click the symbol to the right of network key to generate a secure network key (or enter your own)
  • click save

If this is done right after a few mins when you return to the main page the HomeID and Home Hex should be populated, if they are not refer to troubleshooting guide.

# Configure MQTT
Assumes you are already running an MQTT container like the one in home assistant supervisor mode or mosquitto from docker
TODO (waiting on seeming issues with raZberry module on reboots……

# Configure Gateway
TO DO
