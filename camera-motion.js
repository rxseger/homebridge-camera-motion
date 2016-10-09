'use strict';

const FIFO = require('fifo-js');

let Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-camera-motion', 'CameraMotion', CameraMotionPlugin);
};

class CameraMotionPlugin
{
  constructor(log, config) {
    this.log = log;
    this.name = config.name;

    this.pipePath = config.pipePath || '/tmp/camera-pipe';
    this.pipe = new FIFO(this.pipePath);
    this.pipe.setReader(this.onPipeRead.bind(this));

    this.motionService = new Service.MotionSensor(this.name);

    this.motionService
      .getCharacteristic(Characteristic.MotionDetected)
      .setValue(false);
    // TODO: notify?!
    // TODO: change value on motion detected event
  }

  onPipeRead(text) {
    console.log(`got from pipe: |${text}|`);
    // on_picture_save printf '%f\t%n\t%v\t%i\t%J\t%K\t%L\t%N\t%D\n' > /tmp/camera-pipe
    // http://htmlpreview.github.io/?https://github.com/Motion-Project/motion/blob/master/motion_guide.html#conversion_specifiers
    // %f filename with full path
    // %n number indicating filetype
    // %v event
    // %i width of motion area
    // %J height of motion area
    // %K X coordinates of motion center
    // %L Y coordinates of motion center
    // %N noise level
    // %D changed pixels
    const [filename, filetype, event, width, height, x, y, noise, dpixels] = text.trim().split('\t');
    console.log('filename is',filename);

    this.motionService
      .getCharacteristic(Characteristic.MotionDetected)
      .setValue(true);
  }

  getServices() {
    return [this.motionService];
  }
}

