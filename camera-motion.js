'use strict';

const FIFO = require('fifo-js');

let Service, Characteristic, UUIDGen;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform('homebridge-camera-motion', 'CameraMotion', CameraMotionPlatform, true);
  //homebridge.registerAccessory('homebridge-camera-motion', 'CameraMotion', CameraMotionPlugin);
};

class CameraMotionPlatform
{
  constructor(log, config, api) {
    log(`CameraMotion Platform Plugin starting`);
    this.log = log;
    config = config || {};
    this.name = config.name || 'CameraMotionPlatform';

    this.pipePath = config.pipePath || '/tmp/camera-pipe';
    this.timeout = config.timeout !== undefined ? config.timeout : 2000;

    this.pipe = new FIFO(this.pipePath);
    this.pipe.setReader(this.onPipeRead.bind(this));

    this.motionService = new Service.MotionSensor(this.name);
    this.setMotion(false);

  }

  setMotion(detected) {
    this.motionService
      .getCharacteristic(Characteristic.MotionDetected)
      .setValue(detected);
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

    this.setMotion(true);

    setTimeout(() => this.setMotion(false), this.timeout); // TODO: is this how this works?
  }

  getServices() {
    return [this.motionService];
  }

  accessories(cb) {
    cb([this]);
  }
}
