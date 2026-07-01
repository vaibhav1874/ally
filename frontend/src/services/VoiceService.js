// Web Speech API Voice and Recognition Service

class VoiceService {
  constructor() {
    this.recognition = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isListening = false;
    this.onResult = null;
    this.onStatusChange = null;
  }

  /**
   * Initializes Speech Recognition engine.
   * @param {function} onResultCallback - Callback when transcript is finalized.
   * @param {function} onStatusChangeCallback - Callback for listening state updates.
   */
  initRecognition(onResultCallback, onStatusChangeCallback) {
    const SpeechRecognition = 
      typeof window !== 'undefined' && 
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      console.warn("Web Speech Recognition API is not supported in this browser. Voice features are disabled.");
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true; // Keep listening
    this.recognition.interimResults = false; // Only final transcripts
    this.recognition.lang = 'en-US';

    this.onResult = onResultCallback;
    this.onStatusChange = onStatusChangeCallback;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStatusChange) this.onStatusChange(true);
    };

    this.recognition.onend = () => {
      // Auto-restart if we want it to stay continuous, unless explicitly stopped
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          // ignore start error if already running
        }
      } else {
        if (this.onStatusChange) this.onStatusChange(false);
      }
    };

    this.recognition.onerror = (event) => {
      console.error("Speech Recognition Error: ", event.error);
      if (event.error === 'not-allowed') {
        this.isListening = false;
        if (this.onStatusChange) this.onStatusChange(false);
      }
    };

    this.recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      
      const finalText = transcript.trim();
      if (finalText && this.onResult) {
        this.onResult(finalText);
      }
    };

    return true;
  }

  startListening() {
    if (!this.recognition) return;
    this.isListening = true;
    try {
      this.recognition.start();
    } catch (e) {
      console.warn("Recognition already started: ", e.message);
    }
  }

  stopListening() {
    this.isListening = false;
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch (e) {
      console.warn("Recognition already stopped: ", e.message);
    }
  }

  /**
   * Speaks the provided text using SpeechSynthesis.
   * @param {string} text - Text message to speak.
   * @param {string} voiceName - Name of the voice chosen in settings.
   * @param {number} rate - Speech speed multiplier.
   * @param {function} onStart - Speaking started event callback.
   * @param {function} onEnd - Speaking ended event callback.
   */
  speak(text, voiceName = '', rate = 1.0, onStart = null, onEnd = null) {
    if (!this.synth) return;

    // Cancel active speaking to avoid overlap
    this.synth.cancel();

    // Clean markdown structures (like asterisk logs, links) to sound clean
    const cleanText = text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks entirely
      .replace(/[*#_`~]/g, '') // remove asterisks, hash, formatting
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // replace markdown links with title
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;

    // Find and set requested voice
    if (voiceName) {
      const voices = this.synth.getVoices();
      const match = voices.find(v => v.name === voiceName);
      if (match) utterance.voice = match;
    }

    if (onStart) utterance.onstart = onStart;
    
    // Wrap onend and handle error cases
    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = (e) => {
      console.error("Speech Synthesis Utterance Error: ", e);
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  cancelSpeaking() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const voiceService = new VoiceService();
