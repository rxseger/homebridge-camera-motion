'use strict';

const fs = require('fs');
const ip = require('ip');
const FIFO = require('fifo-js');
const spawn = require('child_process').spawn;

let Service, Characteristic, uuid, StreamController, Accessory, hap;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  uuid = homebridge.hap.uuid;
  StreamController = homebridge.hap.StreamController;
  Accessory = homebridge.platformAccessory;
  hap = homebridge.hap;

  homebridge.registerPlatform('homebridge-camera-motion', 'CameraMotion', CameraMotionPlatform, true);
};

class CameraMotionPlatform
{
  constructor(log, config, api) {
    log(`CameraMotion Platform Plugin starting`,config);
    this.log = log;
    this.api = api;
    this.config = config;
    if (!config) return; // TODO: what gives with initializing platforms twice, once with config once without?
    this.name = config.name || 'Camera';

    this.motionAccessory = new CameraMotionAccessory(log, config, api);

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  accessories(cb) {
    cb([this.motionAccessory]);
  }

  didFinishLaunching() {
    if (global._mcp_launched) return; // call only once
    global._mcp_launched = true; // TODO: really, why is this called twice? from where?

    const cameraName = this.name;
    const uu = uuid.generate(cameraName);
    console.log('uuid=',uu);
    const cameraAccessory = new Accessory(cameraName, uu, hap.Accessory.Categories.CAMERA);
    this.cameraSource = new CameraSource(hap, this.config);
    cameraAccessory.configureCameraSource(this.cameraSource);
    this.motionAccessory.setSource(this.cameraSource);
    const configuredAccessories = [cameraAccessory];
    this.api.publishCameraAccessories('CameraMotion', configuredAccessories);
    this.log(`published camera`);
  }
}

// An accessory with a MotionSensor service
class CameraMotionAccessory
{
  constructor(log, config, api) {
    log(`CameraMotion accessory starting`);
    this.log = log;
    this.api = api;
    config = config || {};
    this.name = config.name_motion || 'Motion Detector';

    this.pipePath = config.motion_pipe || '/tmp/motion-pipe';
    this.timeout = config.motion_timeout !== undefined ? config.motion_timeout : 2000;

    this.pipe = new FIFO(this.pipePath);
    this.pipe.setReader(this.onPipeRead.bind(this));

    this.motionService = new Service.MotionSensor(this.name);
    this.setMotion(false);
  }

  setSource(cameraSource) {
    this.cameraSource = cameraSource;
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
    this.cameraSource.snapshot_path = filename;
    this.setMotion(true);

    setTimeout(() => this.setMotion(false), this.timeout); // TODO: is this how this works?
  }

  getServices() {
    return [this.motionService];
  }
}

// Source for the camera images
class CameraSource
{
  constructor(hap, config) {
    this.hap = hap;
    this.config = config;
    this.snapshot_path = '/tmp/lastsnap.jpg'; // Will be reset by onPipeRead(...)
    this.ffmpeg_path = config.ffmpeg_path || false;
    this.ffmpegSource = config.ffmpeg_source;

    this.pendingSessions = {};
    this.ongoingSessions = {};

    this.services = []; // TODO: where is this used?

    // Create control service
    this.controlService = new Service.CameraControl();

    // Create stream controller(s) (only one for now TODO: more?)

    const videoResolutions = [
        // width, height, fps
        [1920, 1080, 30],
        [320, 240, 15],
        [1280, 960, 30],
        [1280, 720, 30],
        [1024, 768, 30],
        [640, 480, 30],
        [640, 360, 30],
        [480, 360, 30],
        [480, 270, 30],
        [320, 240, 30],
        [320, 180, 30]
   ];

   // see https://github.com/KhaosT/homebridge-camera-ffmpeg/blob/master/ffmpeg.js
   const options = {
     proxy: false, // Requires RTP/RTCP MUX Proxy
     srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
     video: {
       resolutions: videoResolutions,
       codec: {
         profiles: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamProfileIDTypes
         levels: [0, 1, 2] // Enum, please refer StreamController.VideoCodecParamLevelTypes
       }
     },
     audio: {
       codecs: [
         {
           type: "OPUS", // Audio Codec
           samplerate: 24 // 8, 16, 24 KHz
         },
         {
           type: "AAC-eld",
           samplerate: 16
         }
       ]
     }
   };


   this.streamController = new StreamController(0, options, this);
   this.services.push(this.streamController.service);
  }

  handleCloseConnection(connectionID) {
    this.streamController.handleCloseConnection(connectionID);
  }

  // stolen from https://github.com/KhaosT/homebridge-camera-ffmpeg/blob/master/ffmpeg.js TODO: why can't this be in homebridge itself?
  prepareStream(request, cb) {
    var sessionInfo = {};
  
    let sessionID = request["sessionID"];
    let targetAddress = request["targetAddress"];
  
    sessionInfo["address"] = targetAddress;
  
    var response = {};
  
    let videoInfo = request["video"];
    if (videoInfo) {
      let targetPort = videoInfo["port"];
      let srtp_key = videoInfo["srtp_key"];
      let srtp_salt = videoInfo["srtp_salt"];
  
      let videoResp = {
        port: targetPort,
        ssrc: 1,
        srtp_key: srtp_key,
        srtp_salt: srtp_salt
      };
  
      response["video"] = videoResp;
  
      sessionInfo["video_port"] = targetPort;
      sessionInfo["video_srtp"] = Buffer.concat([srtp_key, srtp_salt]);
      sessionInfo["video_ssrc"] = 1; 
    }
  
    let audioInfo = request["audio"];
    if (audioInfo) {
      let targetPort = audioInfo["port"];
      let srtp_key = audioInfo["srtp_key"];
      let srtp_salt = audioInfo["srtp_salt"];
  
      let audioResp = {
        port: targetPort,
        ssrc: 1,
        srtp_key: srtp_key,
        srtp_salt: srtp_salt
      };
  
      response["audio"] = audioResp;
  
      sessionInfo["audio_port"] = targetPort;
      sessionInfo["audio_srtp"] = Buffer.concat([srtp_key, srtp_salt]);
      sessionInfo["audio_ssrc"] = 1; 
    }

    let currentAddress = ip.address();
    console.log('currentAddress',currentAddress);
    var addressResp = {
        address: currentAddress
    };
    console.log('addressResp',addressResp);

    if (ip.isV4Format(currentAddress)) {
        addressResp["type"] = "v4";
    } else {
        addressResp["type"] = "v6";
    }

    response["address"] = addressResp;

    this.pendingSessions[uuid.unparse(sessionID)] = sessionInfo;
    cb(response)
  }

  // also based on homebridge-camera-ffmpeg!
  handleStreamRequest(request) {
    if (!this.ffmpeg_path) {
      console.log(`No ffmpeg_path set, ignoring handleStreamRequest`,request);
      return;
    }
    console.log('received handleStreamRequest',request);

    var sessionID = request["sessionID"];
    var requestType = request["type"];
    if (sessionID) {
      let sessionIdentifier = uuid.unparse(sessionID);

      if (requestType == "start") {
        var sessionInfo = this.pendingSessions[sessionIdentifier];
        console.log('starting',sessionInfo);
        if (sessionInfo) {
          var width = 1280;
          var height = 720;
          var fps = 30;
          var bitrate = 300;
  
          let videoInfo = request["video"];
          if (videoInfo) {
            width = videoInfo["width"];
            height = videoInfo["height"];
  
            let expectedFPS = videoInfo["fps"];
            if (expectedFPS < fps) {
              fps = expectedFPS;
            }
  
            bitrate = videoInfo["max_bit_rate"];
          }
  
          let targetAddress = sessionInfo["address"];
          let targetVideoPort = sessionInfo["video_port"];
          let videoKey = sessionInfo["video_srtp"];
  
          let ffmpegCommand = this.ffmpegSource + ' -threads 0 -vcodec libx264 -an -pix_fmt yuv420p -r '+ fps +' -f rawvideo -tune zerolatency -vf scale='+ width +':'+ height +' -b:v '+ bitrate +'k -bufsize '+ bitrate +'k -payload_type 99 -ssrc 1 -f rtp -srtp_out_suite AES_CM_128_HMAC_SHA1_80 -srtp_out_params '+videoKey.toString('base64')+' srtp://'+targetAddress+':'+targetVideoPort+'?rtcpport='+targetVideoPort+'&localrtcpport='+targetVideoPort+'&pkt_size=1378';
          console.log('about to spawn ffmpeg');
          console.log(ffmpegCommand);
          let ffmpeg = spawn(this.ffmpeg_path, ffmpegCommand.split(' '), {env: process.env});
          this.ongoingSessions[sessionIdentifier] = ffmpeg;
        }
  
        delete this.pendingSessions[sessionIdentifier];
      } else if (requestType == "stop") {
        var ffmpegProcess = this.ongoingSessions[sessionIdentifier];
        if (ffmpegProcess) {
          ffmpegProcess.kill('SIGKILL');
        }
  
        delete this.ongoingSessions[sessionIdentifier];
      }
    }
  }

  handleSnapshotRequest(request, cb) {
    console.log('handleSnapshotRequest',request);
    fs.readFile(this.snapshot_path, (err, data) => {
      if (err) return cb(err);

      // TODO: scale to requested dimensions
      cb(null, data);
    });
  }
}

