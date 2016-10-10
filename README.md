# homebridge-camera-motion

## Installation
1.	Install Homebridge using `npm install -g homebridge`
2.	Install this plugin `npm install -g homebridge-camera-motion`
3.	Update your configuration file - see below for an example
4.	Install and configure [Motion](https://motion-project.github.io)

Add to your `~/.motion/motion.conf`:

```
on_picture_save printf '%f\t%n\t%v\t%i\t%J\t%K\t%L\t%N\t%D\n' > /tmp/camera-pipe
```

5.	Pair to the camera (requires pairing separately than the rest of the Homebridge)

## Configuration
* `accessory`: "CameraMotion"
* `name`: descriptive name
* `pipePath`: path to a [Unix named pipe](https://en.wikipedia.org/wiki/Named_pipe) to communicate with the camera
(will be created if needed, must match output file pipe written to by Motion on_picture_save)
* `timeout`: reset the motion detector after this many milliseconds

Example configuration:

```json
    "platforms": [
        {
                "platform": "CameraMotion",
                "name": "Window"
        }
    ]
```

## License

MIT

