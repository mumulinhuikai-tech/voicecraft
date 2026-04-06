import type { Emotion } from '@/types/tts'

/**
 * Maps UI emotion labels to ElevenLabs voice settings.
 *
 * ElevenLabs voice settings:
 *   stability (0–1): Lower = more expressive/variable, Higher = more stable/consistent
 *   similarityBoost (0–1): How closely to match the reference voice
 *   style (0–1): Style exaggeration (0 = neutral, 1 = very stylized)
 *   useSpeakerBoost: Boost likeness to the speaker
 *
 * We also produce a system prompt hint for models that support it.
 */
export interface EmotionVoiceSettings {
  stability: number
  similarityBoost: number
  style: number
  useSpeakerBoost: boolean
  /** Optional prompt hint to prepend or use as style guidance */
  promptHint: string
  /** Multiplier applied to user's speed setting (1.0 = no change) */
  speedMultiplier: number
}

export const EMOTION_MAP: Record<Emotion, EmotionVoiceSettings> = {
  calm: {
    stability: 0.75,
    similarityBoost: 0.75,
    style: 0.15,
    useSpeakerBoost: true,
    promptHint: 'Speak in a calm, composed, and peaceful manner.',
    speedMultiplier: 0.95,
  },
  warm: {
    stability: 0.65,
    similarityBoost: 0.80,
    style: 0.30,
    useSpeakerBoost: true,
    promptHint: 'Speak in a warm, friendly, and sincere manner.',
    speedMultiplier: 0.97,
  },
  serious: {
    stability: 0.85,
    similarityBoost: 0.75,
    style: 0.10,
    useSpeakerBoost: true,
    promptHint: 'Speak in a serious, authoritative, and deliberate manner.',
    speedMultiplier: 0.92,
  },
  joyful: {
    stability: 0.45,
    similarityBoost: 0.75,
    style: 0.60,
    useSpeakerBoost: true,
    promptHint: 'Speak in a joyful, upbeat, and cheerful manner.',
    speedMultiplier: 1.05,
  },
  sad: {
    stability: 0.70,
    similarityBoost: 0.75,
    style: 0.35,
    useSpeakerBoost: true,
    promptHint: 'Speak in a soft, gentle, and sorrowful manner.',
    speedMultiplier: 0.88,
  },
  excited: {
    stability: 0.35,
    similarityBoost: 0.70,
    style: 0.75,
    useSpeakerBoost: true,
    promptHint: 'Speak in an excited, energetic, and enthusiastic manner.',
    speedMultiplier: 1.10,
  },
  encouraging: {
    stability: 0.55,
    similarityBoost: 0.80,
    style: 0.45,
    useSpeakerBoost: true,
    promptHint: 'Speak in an encouraging, uplifting, and supportive manner.',
    speedMultiplier: 1.0,
  },
}

export function getEmotionSettings(emotion: Emotion): EmotionVoiceSettings {
  return EMOTION_MAP[emotion] ?? EMOTION_MAP.calm
}
