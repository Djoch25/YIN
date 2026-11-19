
let currentMidiPitch = -1;

let workletNode = null;
let stream = null;
let source = null;
let audioContext = null;
let oscillator = null;
let testMode = false;

const cnv = document.createElement("canvas");
const ctx = cnv.getContext("2d");

cnv.width = 650;
cnv.height = 350;

ctx.font = "20px Arial";
document.body.appendChild(cnv);

// ------------------------------------
// AVVIO MICROFONO
// ------------------------------------

const startMic = async () => {
    try {
        await stopMic();

        testMode = false;

        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 1
            }
        });

        audioContext = new AudioContext();

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        console.log("AudioContext sample rate:",
                    audioContext.sampleRate);

        await audioContext.audioWorklet.addModule(
            "audio_worklet.js"
        );

        workletNode = new AudioWorkletNode(
            audioContext,
            "audio_worklet"
        );

        workletNode.port.onmessage = (event) => {
            updatePitchDisplay(event.data);
        };

        source = audioContext.createMediaStreamSource(stream);

        source.connect(workletNode);

    } catch (error) {
        console.error("Audio initialization error:", error);
    }
};


// ------------------------------------
// TEST CON SINUSOIDE A 440 Hz
// ------------------------------------

const start440Test = async () => {
    try {
        await stopMic();

        testMode = true;

        audioContext = new AudioContext();

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        await audioContext.audioWorklet.addModule(
            "audio_worklet.js"
        );

        workletNode = new AudioWorkletNode(
            audioContext,
            "audio_worklet"
        );

        workletNode.port.onmessage = (event) => {
            updatePitchDisplay(event.data);
        };

        oscillator = audioContext.createOscillator();

        oscillator.type = "sine";
        oscillator.frequency.value = 440;

        oscillator.connect(workletNode);
        oscillator.start();

        console.log("440 Hz test started");
        console.log("Sample rate:", audioContext.sampleRate);

    } catch (error) {
        console.error("440 Hz test error:", error);
    }
};


// ------------------------------------
// VISUALIZZAZIONE
// ------------------------------------

const updatePitchDisplay = (data) => {

    const {
        frequency,
        confidence,
        volume,
        allow,
        sr,
        tau
    } = data;

    if (frequency > 0 && confidence >= 0) {
        currentMidiPitch = Math.round(
            12 * Math.log2(frequency / 440)
        ) + 69;
    } else {
        currentMidiPitch = -1;
    }

    ctx.clearRect(0, 0, cnv.width, cnv.height);

    ctx.fillText(
        "Frequency: " + frequency.toFixed(2) + " Hz",
        20, 40
    );

    ctx.fillText(
        "MIDI Number: " + currentMidiPitch,
        20, 80
    );

    ctx.fillText(
        "Confidence: " + confidence.toFixed(4),
        20, 120
    );

    ctx.fillText(
        "Volume: " + volume.toFixed(6),
        20, 160
    );

    ctx.fillText(
        "Sample Rate: " + sr,
        20, 200
    );

    ctx.fillText(
        "Tau: " + tau.toFixed(3),
        20, 240
    );

    ctx.fillText(
        "Allow YIN: " + allow,
        20, 280
    );

    ctx.fillText(
        "Mode: " + (testMode ? "440 Hz TEST" : "MICROPHONE"),
        20, 320
    );
};


// ------------------------------------
// ARRESTO
// ------------------------------------

const stopMic = async () => {

    if (oscillator) {
        try {
            oscillator.stop();
        } catch (e) {}

        oscillator.disconnect();
        oscillator = null;
    }

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    workletNode?.disconnect();
    source?.disconnect();

    if (audioContext) {
        await audioContext.close();
    }

    workletNode = null;
    source = null;
    audioContext = null;

    currentMidiPitch = -1;
};


// ------------------------------------
// CONTROLLO SOGLIA YIN
// ------------------------------------

const setYinThreshold = (value) => {
    workletNode?.port.postMessage({
        command: "setThreshold",
        value: value
    });
};


// ------------------------------------
// AVVIO
// ------------------------------------

startMic();
