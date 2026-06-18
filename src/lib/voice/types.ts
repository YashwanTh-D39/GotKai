export type VoiceGender = "male" | "female";
export type VoiceAge = "young" | "mature";
export type VoicePersona = "professional" | "friendly" | "energetic" | "calm";
export type VoiceAccent = "us" | "uk" | "au" | "in" | "none";

export type VoiceProfile = {
  id: string;
  name: string;
  emoji: string;
  gender: VoiceGender;
  age: VoiceAge;
  persona: VoicePersona;
  accent: VoiceAccent;
  description: string;
  // Web Speech API voice matching hints
  voiceHints: string[];
  // Default speech params
  defaultPitch: number;
  defaultRate: number;
};

export type VoiceSettings = {
  activeVoiceId: string;
  pitch: number;
  rate: number;
  autoTTS: boolean;
  continuousMode: boolean;
  voiceInputEnabled: boolean;
  emotionEnabled: boolean;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  activeVoiceId: "calm-female",
  pitch: 1.0,
  rate: 1.0,
  autoTTS: false,
  continuousMode: false,
  voiceInputEnabled: true,
  emotionEnabled: true,
};

export const PITCH_MIN = 0.5;
export const PITCH_MAX = 2.0;
export const PITCH_STEP = 0.1;
export const RATE_MIN = 0.5;
export const RATE_MAX = 2.0;
export const RATE_STEP = 0.1;
