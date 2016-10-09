# homebridge-camera-motion

## Installation
1.	Install Homebridge using `npm install -g homebridge`
2.	Install this plugin `npm install -g homebridge-camera-motion`
3.	Update your configuration file - see below for an example

Connect the BME280 chip to the I2C bus

## Configuration
* `accessory`: "CameraMotion"
* `name`: descriptive name

Example configuration:

```json
    "accessories": [
        {
            "accessory": "CameraMotion",
            "name": "Window"
        }
    ]
```

## License

MIT

