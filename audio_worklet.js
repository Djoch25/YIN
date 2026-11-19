
class PitchProcessor extends AudioWorkletProcessor {

    constructor() {
        super();

        this.bufferSize = 2048;
        this.buffer = new Float32Array(this.bufferSize);
        this.index = 0;

        this.maxLag = 1000;

        this.threshold = 0.1;
        this.allowYinDetection = true;

        this.port.onmessage = (event) => {

            const data = event.data;

            if (data === "stopYinDetection") {
                this.allowYinDetection = false;
            }

            else if (data === "startYinDetection") {
                this.allowYinDetection = true;
            }

            else if (data?.command === "setThreshold") {
                this.threshold = Math.max(
                    0.001,
                    Math.min(0.5, data.value)
                );
            }
        };
    }


    process(inputs, outputs) {

        const input = inputs[0];

        if (!input || input.length === 0) {
            return true;
        }

        const samples = input[0];

        if (!samples) {
            return true;
        }

        for (let i = 0; i < samples.length; i++) {

            this.buffer[this.index] = samples[i];

            this.index++;

            if (this.index >= this.bufferSize) {

                const volume = getVolume(this.buffer);

                let result = {
                    frequency: -1,
                    confidence: -1,
                    tau: -1
                };

                if (this.allowYinDetection) {

                    result = yin(
                        this.buffer,
                        sampleRate,
                        this.maxLag,
                        this.threshold
                    );
                }

                this.port.postMessage({

                    frequency: result.frequency,
                    confidence: result.confidence,
                    tau: result.tau,

                    volume: volume,

                    allow: this.allowYinDetection,

                    sr: sampleRate
                });

                this.index = 0;
            }
        }

        return true;
    }
}


// ------------------------------------
// YIN
// ------------------------------------

const yin = (
    buffer,
    sampleRate,
    maxLag,
    threshold = 0.1
) => {

    const len = buffer.length;

    const df = new Float32Array(maxLag + 1);

    // 1. Difference Function

    for (let tau = 0; tau <= maxLag; tau++) {

        let sum = 0;

        for (let i = 0; i < len - tau; i++) {

            const diff = buffer[i] - buffer[i + tau];

            sum += diff * diff;
        }

        df[tau] = sum;
    }


    // 2. CMNDF

    const cmndf = new Float32Array(maxLag + 1);

    cmndf[0] = 1;

    let runningSum = 0;

    for (let tau = 1; tau <= maxLag; tau++) {

        runningSum += df[tau];

        cmndf[tau] = runningSum === 0
            ? 1
            : (df[tau] * tau) / runningSum;
    }


    // 3. Absolute Threshold

    let tau = -1;

    for (let i = 2; i <= maxLag; i++) {

        if (cmndf[i] < threshold) {

            while (
                i + 1 <= maxLag &&
                cmndf[i + 1] < cmndf[i]
            ) {
                i++;
            }

            tau = i;

            break;
        }
    }

    if (tau === -1) {

        return {
            frequency: -1,
            confidence: -1,
            tau: -1
        };
    }


    // 4. Parabolic Interpolation

    let betterTau = tau;

    if (tau > 0 && tau < maxLag) {

        const s0 = cmndf[tau - 1];
        const s1 = cmndf[tau];
        const s2 = cmndf[tau + 1];

        const denominator = 2 * (2 * s1 - s2 - s0);

        if (Math.abs(denominator) > 1e-12) {

            betterTau += (s2 - s0) / denominator;
        }
    }


    // 5. Fundamental Frequency

    const frequency = sampleRate / betterTau;

    return {

        frequency: frequency,

        confidence: 1 - cmndf[tau],

        tau: betterTau
    };
};


// ------------------------------------
// RMS VOLUME
// ------------------------------------

const getVolume = (buffer) => {

    let sum = 0;

    for (let i = 0; i < buffer.length; i++) {

        sum += buffer[i] * buffer[i];
    }

    return sum / buffer.length;
};


registerProcessor("audio_worklet", PitchProcessor);
