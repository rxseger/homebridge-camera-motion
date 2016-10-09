'use strict';

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

    this.motionService = new Service.MotionSensor(this.name);

    this.motionService
      .getCharacteristic(Characteristic.MotionDetected)
      .setValue(false);
    // TODO: notify?!
    // TODO: change value on motion detected event
  }

  getMotionDetected(cb) {
    console.log('was motion detected? ');
    cb(null, false); // TODO
  }

  getServices() {
    return [this.motionService];
  }
}

