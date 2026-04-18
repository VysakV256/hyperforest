import * as Tone from 'tone';

class AudioEngine {
    constructor() {
        this.initialized = false;
        this.droneSynth = null;
        this.soloSynth = null;
        this.sequence = null;
    }

    async init() {
        if (this.initialized) return;
        
        // Standard Web Audio Context Initialization
        await Tone.start();

        // 1. Master Environmental Acoustics
        this.masterReverb = new Tone.Reverb({ decay: 8, wet: 0.65 }).toDestination();
        this.masterFilter = new Tone.AutoFilter("0.1n").connect(this.masterReverb).start();
        
        // 2. Cosmic Background Drone (Simulating 342 shifting objects)
        this.droneSynth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 1.5,
            modulationIndex: 3.1,
            oscillator: { type: "sine" },
            envelope: { attack: 4, decay: 2, sustain: 1, release: 5 },
            modulation: { type: "triangle" },
            modulationEnvelope: { attack: 2, decay: 1, sustain: 0.8, release: 2 }
        }).connect(this.masterFilter);
        
        this.droneSynth.volume.value = -23; // Subtle hum

        // 3. Isolated Dataset Synthesizer (The Physical Nodes)
        this.soloSynth = new Tone.Synth({
            oscillator: { type: "sawtooth8" },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 1.5 }
        });
        
        const feedbackDelay = new Tone.FeedbackDelay("8n", 0.4);
        this.soloSynth.chain(feedbackDelay, this.masterReverb);
        this.soloSynth.volume.value = -12;

        this.initialized = true;
        
        // Prime Tone Transport
        Tone.Transport.start();

        // Trigger infinite cosmic background chord
        this.droneSynth.triggerAttack(["G2", "D3", "Bb3"]);
    }

    playNode(nodeData) {
        if (!this.initialized) return;
        
        // Scavenge old sequences gracefully
        if (this.sequence) {
            this.sequence.stop();
            this.sequence.dispose();
            this.sequence = null;
        }

        // Dip the background drone organically
        this.droneSynth.volume.rampTo(-38, 1);

        if (!nodeData || !nodeData.csv_preview || nodeData.csv_preview.length === 0) {
            // Float the background hum back up when the player drops the node
            this.droneSynth.volume.rampTo(-23, 2);
            return;
        }

        // Physical Data Mapping algorithm -> Ethereal/Sci-Fi Pentatonic Sequences
        const scale = ["C", "D", "E", "G", "A"];
        const values = nodeData.csv_preview.map(p => p.value);
        
        // Guard mathematically identical values
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values) || (minVal + 1);
        
        // Map native data string directly into musical scale
        const notes = values.map((val) => {
            const norm = (val - minVal) / (maxVal - minVal);
            const octave = Math.floor(norm * 2) + 3; // Operates naturally in octaves 3-5
            const noteIdx = Math.floor((norm * 4.99)); 
            return `${scale[noteIdx]}${octave}`;
        });

        // We capture roughly 16 steps out of the dataset to arpeggiate
        const stepResolution = Math.max(1, Math.floor(notes.length / 16));
        const sequenceNotes = notes.filter((_, i) => i % stepResolution === 0).slice(0, 16);
        
        let step = 0;
        this.sequence = new Tone.Loop((time) => {
            if (sequenceNotes.length === 0) return;
            const currentNote = sequenceNotes[step % sequenceNotes.length];
            this.soloSynth.triggerAttackRelease(currentNote, "16n", time);
            step++;
        }, "8n").start(0);
    }
}

export const audioEngine = new AudioEngine();
