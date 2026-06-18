import type { VoiceProfile, VoiceSettings } from "./types";
import { getVoiceProfile } from "./profiles";

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;

function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesLoaded) return Promise.resolve(cachedVoices);
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const check = () => {
      const v = synth.getVoices();
      if (v.length > 0) {
        cachedVoices = v;
        voicesLoaded = true;
        resolve(v);
      } else {
        setTimeout(check, 100);
      }
    };
    synth.onvoiceschanged = () => {
      cachedVoices = synth.getVoices();
      voicesLoaded = true;
      resolve(cachedVoices);
    };
    check();
  });
}

function pickVoice(profile: VoiceProfile): SpeechSynthesisVoice | null {
  const available = cachedVoices;
  if (available.length === 0) return null;

  const langMap: Record<string, string> = {
    us: "en-US", uk: "en-GB", au: "en-AU", in: "en-IN", none: "en-US",
  };
  const targetLang = langMap[profile.accent] || "en-US";

  // Best match: language + gender hint
  const best = available.find(
    (v) =>
      v.lang.startsWith(targetLang) &&
      profile.voiceHints.some((h) => v.name.toLowerCase().includes(h.toLowerCase())),
  );
  if (best) return best;

  // Fallback: language match
  const langMatch = available.find((v) => v.lang.startsWith(targetLang));
  if (langMatch) return langMatch;

  // Last resort: any English voice
  return available.find((v) => v.lang.startsWith("en")) || available[0];
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(
  text: string,
  profileOrId: VoiceProfile | string,
  settings?: Partial<VoiceSettings>,
): void {
  if (!("speechSynthesis" in window)) return;
  synth.cancel();

  const profile =
    typeof profileOrId === "string" ? getVoiceProfile(profileOrId) : profileOrId;
  if (!profile) return;

  const pitch = settings?.pitch ?? profile.defaultPitch;
  const rate = settings?.rate ?? profile.defaultRate;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = pitch;
  utterance.rate = rate;
  utterance.volume = 1;

  // Add expressive pauses for natural speech
  utterance.text = addExpressivePauses(text);

  const voice = pickVoice(profile);
  if (voice) utterance.voice = voice;

  currentUtterance = utterance;
  synth.speak(utterance);
}

export function stopSpeech(): void {
  if (!("speechSynthesis" in window)) return;
  synth.cancel();
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return synth.speaking;
}

export function onSpeechEnd(callback: () => void): void {
  if (currentUtterance) {
    currentUtterance.onend = callback;
  }
}

// Split long text into sentences and speak them sequentially
// to avoid the 200-char truncation bug in some browsers
export function speakLong(
  text: string,
  profile: VoiceProfile,
  settings?: Partial<VoiceSettings>,
): void {
  if (!("speechSynthesis" in window)) return;

  const sentences = splitIntoSentences(text);
  let index = 0;

  function speakNext() {
    if (index >= sentences.length) return;
    const s = sentences[index++];
    speak(s, profile, settings);
    onSpeechEnd(speakNext);
  }

  speakNext();
}

function splitIntoSentences(text: string): string[] {
  const clean = text.replace(/\n+/g, ". ").replace(/\s+/g, " ").trim();
  const parts = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  const result: string[] = [];
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed) result.push(trimmed);
  }
  return result.length > 0 ? result : [text];
}

function addExpressivePauses(text: string): string {
  return text
    .replace(/\. /g, ". ... ")       // Longer pause after sentences
    .replace(/\, /g, ", ... ")        // Slight pause after commas
    .replace(/\? /g, "? ... ")       // Pause after questions
    .replace(/\! /g, "! ... ");      // Pause after exclamations
}

const synth = typeof window !== "undefined" ? window.speechSynthesis : ({} as SpeechSynthesis);

export { ensureVoices, pickVoice };
