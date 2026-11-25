
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
cnv.height = 430;

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

        const track = stream.getAudioTracks()[0];

        ctx.fillText("Microphone settings: " + track.getSettings(), 200, 50);
        ctx.fillText("Audio constraints: + " + track.getConstraints(), 200, 250);
        ctx.fillText("Supported constraints: " + navigator.mediaDevices.getSupportedConstraints(), 200, 300);

        debugger;
        return;
        
        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        await audioContext.audioWorklet.addModule(
            "audio_worklet.js?v=diagnostic1"
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

        // Mantiene attivo il processamento audio.
        workletNode.connect(audioContext.destination);

        drawMessage("MICROFONO ATTIVO");

    } catch (error) {
        drawMessage("ERRORE MICROFONO: " + error.message);
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
            "audio_worklet.js?v=diagnostic1"
        );

        workletNode = new AudioWorkletNode(
            audioContext,
            "audio_worklet"
        );

        workletNode.port.onmessage = (event) => {
            updatePitchDisplay(event.data);
        };

        // Mantiene attivo il processamento.
        workletNode.connect(audioContext.destination);

        oscillator = audioContext.createOscillator();

        oscillator.type = "sine";
        oscillator.frequency.value = 440;

        oscillator.connect(workletNode);
        oscillator.start();

        drawMessage("TEST 440 Hz ATTIVO");

    } catch (error) {
        drawMessage("ERRORE TEST: " + error.message);
    }
};


// ------------------------------------
// VISUALIZZAZIONE
// ------------------------------------

const updatePitchDisplay = (data) => {

    const frequency = Number(data.frequency ?? -1);
    const confidence = Number(data.confidence ?? -1);
    const volume = Number(data.volume ?? -1);
    const sr = Number(data.sr ?? 0);
    const tau = Number(data.tau ?? -1);

    const diagnosticFrequency =
        Number(data.diagnosticFrequency ?? -1);

    const diagnosticLag =
        Number(data.diagnosticLag ?? -1);

    const diagnosticCorrelation =
        Number(data.diagnosticCorrelation ?? -1);

    if (frequency > 0 && Number.isFinite(frequency)) {

        currentMidiPitch = Math.round(
            12 * Math.log2(frequency / 440)
        ) + 69;

    } else {
        currentMidiPitch = -1;
    }

    ctx.clearRect(0, 0, cnv.width, cnv.height);

    const lines = [
        "Mode: " + (testMode ? "440 Hz TEST" : "MICROPHONE"),
        "YIN Frequency: " + frequency.toFixed(2) + " Hz",
        "YIN Tau: " + tau.toFixed(3),
        "MIDI: " + currentMidiPitch,
        "Confidence: " + confidence.toFixed(4),
        "Sample Rate: " + sr,
        "Volume: " + volume.toFixed(6),
        "-----------------------------",
        "Autocorrelation: " +
            diagnosticFrequency.toFixed(2) + " Hz",
        "Diagnostic Lag: " + diagnosticLag,
        "Correlation: " +
            diagnosticCorrelation.toFixed(4)
    ];

    lines.forEach((line, i) => {
        ctx.fillText(line, 20, 30 + i * 36);
    });
};


// ------------------------------------
// MESSAGGIO CANVAS
// ------------------------------------

const drawMessage = (message) => {

    ctx.clearRect(0, 0, cnv.width, cnv.height);

    ctx.fillText(message, 20, 40);
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
// PULSANTI
// ------------------------------------

const micButton = document.createElement("button");

micButton.textContent = "Avvia microfono";
micButton.style.fontSize = "20px";
micButton.style.margin = "10px";

document.body.appendChild(micButton);


const testButton = document.createElement("button");

testButton.textContent = "Test 440 Hz";
testButton.style.fontSize = "20px";
testButton.style.margin = "10px";

document.body.appendChild(testButton);


micButton.addEventListener("click", startMic);
testButton.addEventListener("click", start440Test);


// ------------------------------------
// STATO INIZIALE
// ------------------------------------

drawMessage("Premi Avvia microfono oppure Test 440 Hz");

