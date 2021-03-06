# homebridge-camera-motion

[Motion](https://motion-project.github.io) camera plugin for [Homebridge](https://github.com/nfarina/homebridge)

## Installation
1.	Install Homebridge using `npm install -g homebridge`
2.	Install this plugin `npm install -g homebridge-camera-motion`
3.	Update your configuration file - see below for an example
4.	Install and configure [Motion](https://motion-project.github.io)

Add to your `~/.motion/motion.conf`:

```
on_picture_save printf '%f\t%n\t%v\t%i\t%J\t%K\t%L\t%N\t%D\n' > /tmp/motion-pipe
target_dir /tmp
```
5.  Copy homebrige-fixfifo.sh to /home/pi/homebridge-fixfifo.sh and add /home/pi/homebridge-fixfifo.sh to your rc.local file :
```
$ cat /etc/rc.local
#!/bin/sh -e
#
# rc.local
#
# This script is executed at the end of each multiuser runlevel.
# Make sure that the script will "exit 0" on success or any other
# value on error.
#
# In order to enable or disable this script just change the execution
# bits.
#
# By default this script does nothing.

/home/pi/homebridge-fixfifo.sh
exit 0
```
6.	Pair to the camera (requires pairing separately from the rest of the Homebridge)

## Configuration
* `accessory`: "CameraMotion"
* `name`: descriptive name of the Camera service and platform
* `name_motion`: name of MotionDetector service
* `motion_pipe`: path to a [Unix named pipe](https://en.wikipedia.org/wiki/Named_pipe) where motion events are written (will be created if needed, should match output file pipe written to by Motion `on_picture_save`)
* `motion_timeout`: reset the motion detector after this many milliseconds
* `ffmpeg_path`: path to ffmpeg for streaming (optional)
* `ffmpeg_source`: URL to stream source, should match as configured by motion

Example configuration:

```json
    "platforms": [
        {
        "platform": "CameraMotion",
        "name": "Camera",
		"name_motion": "Motion Sensor",
		"motion_pipe": "/tmp/motion-pipe",
		"motion_timeout": 2000,
		"snapshot_path": "/tmp/lastsnap.jpg",
        "ffmpeg_path": "/usr/local/bin/ffmpeg",
        "ffmpeg_source": "-re -i http://192.168.1.100:8081/"

        }
    ]
```

Creates a MotionSensor service and CameraSensor service.

Currently working: snapshots (still images) and motion detection.
Video streaming

## License

MIT

