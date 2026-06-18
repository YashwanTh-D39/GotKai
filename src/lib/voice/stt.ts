export type STTEngine = {
  start: (onResult: (text: string, isFinal: boolean) => void) => void;
  stop: () => void;
  isRunning: () => boolean;
  isSupported: () => boolean;
};

export function createSTTEngine(lang = "en-US"): STTEngine {
  const SpeechRecognitionAPI =
    (typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
    null;

  let recognition: any = null;
  let running = false;

  return {
    isSupported: () => SpeechRecognitionAPI !== null,

    isRunning: () => running,

    start: (onResult) => {
      if (!SpeechRecognitionAPI) return;
      if (recognition) {
        try { recognition.stop(); } catch {}
      }

      recognition = new SpeechRecognitionAPI();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const isFinal = event.results[i].isFinal;
          const transcript = event.results[i][0].transcript;
          onResult(transcript, isFinal);
        }
      };

      recognition.onerror = () => {
        running = false;
      };

      recognition.onend = () => {
        running = false;
        // Auto-restart if still supposed to be running
        if (running) {
          try { recognition.start(); } catch {}
        }
      };

      running = true;
      try {
        recognition.start();
      } catch {
        running = false;
      }
    },

    stop: () => {
      running = false;
      if (recognition) {
        try { recognition.stop(); } catch {}
        recognition = null;
      }
    },
  };
}
