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
        
        // 2. Isolated Dataset Synthesizer (The Physical Nodes)
        this.soloSynth = new Tone.FMSynth({
            harmonicity: 2.01,
            modulationIndex: 1.5,
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, decay: 0.8, sustain: 0.4, release: 3.5 },
            modulation: { type: "sine" },
            modulationEnvelope: { attack: 0.05, decay: 0.5, sustain: 0.1, release: 2 }
        });
        
        const feedbackDelay = new Tone.FeedbackDelay("8n", 0.4);
        this.soloSynth.chain(feedbackDelay, this.masterReverb);
        this.soloSynth.volume.value = -12;

        this.initialized = true;
        
        // Prime Tone Transport
        Tone.Transport.start();
    }

    playNode(nodeData) {
        if (!this.initialized) return;
        
        // Scavenge old sequences gracefully
        if (this.sequence) {
            this.sequence.stop();
            this.sequence.dispose();
            this.sequence = null;
        }

        if (!nodeData || !nodeData.csv_preview || nodeData.csv_preview.length === 0) {
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
