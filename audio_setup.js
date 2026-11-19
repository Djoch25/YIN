let currentMidiPitch = -1;
let workletNode;
let stream;
let source;
let audioContext;

const startMic = async () => {
  stream = await navigator.mediaDevices.getUserMedia({audio: true});
  audioContext = new AudioContext();
  const sampleRate = audioContext.sampleRate;

  await audioContext.audioWorklet.addModule("audio_worklet.js");

  workletNode = new AudioWorkletNode(audioContext, "audio_worklet");

  workletNode.port.onmessage = (event) => {
    const {frequency, confidence, volume, allow} = event.data;
    let stop = "stopYinDetection";

    if (confidence > 0.99) {
      currentMidiPitch = Math.round(12 * Math.log2(frequency / 440)) + 69;
    } else {
      currentMidiPitch = -1;
      stop = null;
    }

    workletNode.port.postMessage(stop);

    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.fillText("Frequency:   " + frequency, 25, 50);
    ctx.fillText("Midi Number: " + currentMidiPitch, 25, 100);
    ctx.fillText("Confidence:  " + confidence, 25, 150);
    ctx.fillText("Volume:      " + volume, 25, 200);
    ctx.fillText("Allow:       " + allow, 25, 250);
  };

  source = audioContext.createMediaStreamSource(stream);
  source.connect(workletNode);
}

const stopMic = async () => {
    stream?.getTracks().forEach((track) => track.stop());

    workletNode?.disconnect();
    source?.disconnect();

    if (audioContext) {
        await audioContext.close();
    }

    stream = null;
    workletNode = null;
    source = null;
    audioContext = null;
    currentMidiPitch = -1;
};


const cnv = document.createElement("canvas");
const ctx = cnv.getContext("2d");
ctx.font = "80px Arial";
cnv.width = 500;
cnv.height = 300;

document.body.appendChild(cnv);
startMic();