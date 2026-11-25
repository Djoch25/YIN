
let currentMidiPitch = -1;

let workletNode = null;
let stream = null;
let source = null;
let audioContext = null;
let oscillator = null;
let testMode = false;
let analyser = null;
let diagnosticTimer = null;

const cnv = document.createElement("canvas");
const ctx = cnv.getContext("2d");

cnv.width = 750;
cnv.height = 650;

ctx.font = "17px Arial";
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
                sampleRate: 48000,
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

        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings();

        source = audioContext.createMediaStreamSource(stream);

        // Analizzatore indipendente da YIN
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        source.connect(analyser);

        await audioContext.audioWorklet.addModule(
            "audio_worklet.js?v=diagnostic2"
        );

        workletNode = new AudioWorkletNode(
            audioContext,
            "audio_worklet"
        );

        workletNode.port.onmessage = (event) => {
            updatePitchDisplay(event.data);
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

        showMicrophoneInfo(track, settings);

        diagnosticTimer = setInterval(() => {
            updateAudioDiagnostics();
        }, 250);

    } catch (error) {
        drawMessage("ERRORE MICROFONO: " + error.message);
    }
};

// ------------------------------------
// INFORMAZIONI MICROFONO
// ------------------------------------

let microphoneInfo = [];

const showMicrophoneInfo = (track, settings) => {

    const capabilities = navigator.mediaDevices
        .getSupportedConstraints();

    microphoneInfo = [
        "DEVICE: " + track.label,
        "SAMPLE RATE: " + audioContext.sampleRate,
        "CHANNELS: " + settings.channelCount,
        "ECHO CANCELLATION: " + settings.echoCancellation,
        "NOISE SUPPRESSION: " + settings.noiseSuppression,
        "AUTO GAIN CONTROL: " + settings.autoGainControl,
        "LATENCY: " + settings.latency,
        "------------------------------",
        "SUPPORTED CONSTRAINTS:",
        "echoCancellation: " + capabilities.echoCancellation,
        "noiseSuppression: " + capabilities.noiseSuppression,
        "autoGainControl: " + capabilities.autoGainControl
    ];

    drawDiagnostics();
};

// ------------------------------------
// ANALISI SEGNALE MICROFONO
// ------------------------------------

let rmsValue = 0;
let peakValue = 0;

const updateAudioDiagnostics = () => {

    if (!analyser) return;

    const buffer = new Float32Array(analyser.fftSize);

    analyser.getFloatTimeDomainData(buffer);

    let sum = 0;
    let peak = 0;

    for (let i = 0; i < buffer.length; i++) {

        const value = buffer[i];

        sum += value * value;

        peak = Math.max(peak, Math.abs(value));
    }

    rmsValue = Math.sqrt(sum / buffer.length);
    peakValue = peak;

    drawDiagnostics();
};

// ------------------------------------
// TEST 440 Hz
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
            "audio_worklet.js?v=diagnostic2"
        );

        workletNode = new AudioWorkletNode(
            audioContext,
            "audio_worklet"
        );

        workletNode.port.onmessage = (event) => {
            updatePitchDisplay(event.data);
        };

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
// VISUALIZZAZIONE YIN
// ------------------------------------

let pitchInfo = [];

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

    pitchInfo = [
        "MODE: " + (testMode ? "440 Hz TEST" : "MICROPHONE"),
        "YIN FREQUENCY: " + frequency.toFixed(2) + " Hz",
        "YIN TAU: " + tau.toFixed(3),
        "MIDI: " + currentMidiPitch,
        "CONFIDENCE: " + confidence.toFixed(4),
        "WORKLET SAMPLE RATE: " + sr,
        "YIN VOLUME: " + volume.toFixed(6),
        "------------------------------",
        "DIAGNOSTIC FREQUENCY: " +
            diagnosticFrequency.toFixed(2),
        "DIAGNOSTIC LAG: " + diagnosticLag,
        "CORRELATION: " +
            diagnosticCorrelation.toFixed(4)
    ];

    drawDiagnostics();
};

// ------------------------------------
// DIAGNOSTICA GRAFICA
// ------------------------------------

const drawDiagnostics = () => {

    ctx.clearRect(0, 0, cnv.width, cnv.height);

    let y = 25;

    ctx.font = "bold 19px Arial";
    ctx.fillText("AUDIO DIAGNOSTICS", 15, y);

    y += 35;

    ctx.font = "16px Arial";

    microphoneInfo.forEach(line => {
        ctx.fillText(line, 15, y);
        y += 23;
    });

    y += 12;

    ctx.font = "bold 17px Arial";
    ctx.fillText("LIVE AUDIO", 15, y);

    y += 28;

    ctx.font = "16px Arial";

    [
        "AUDIOCONTEXT STATE: " +
            (audioContext?.state ?? "CLOSED"),

        "RMS: " + rmsValue.toFixed(7),

        "PEAK: " + peakValue.toFixed(7)
    ].forEach(line => {
        ctx.fillText(line, 15, y);
        y += 25;
    });

    y += 12;

    pitchInfo.forEach(line => {
        ctx.fillText(line, 15, y);
        y += 24;
    });
};

const drawMessage = (message) => {
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.font = "18px Arial";
    ctx.fillText(message, 15, 35);
};

// ------------------------------------
// ARRESTO
// ------------------------------------

const stopMic = async () => {

    if (diagnosticTimer) {
        clearInterval(diagnosticTimer);
        diagnosticTimer = null;
    }

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
    analyser?.disconnect();

    if (audioContext) {
        await audioContext.close();
    }

    workletNode = null;
    source = null;
    analyser = null;
    audioContext = null;

    currentMidiPitch = -1;
    rmsValue = 0;
    peakValue = 0;
};

// ------------------------------------
// SOGLIA YIN
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
