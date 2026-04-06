export type Emotion =
  | 'calm'
  | 'warm'
  | 'serious'
  | 'joyful'
  | 'sad'
  | 'excited'
  | 'encouraging'

export type Language = 'zh' | 'en' | 'mixed'

export type TTSProvider = 'elevenlabs' | 'cartesia' | 'openai'

export interface VoiceSettings {
  stability: number       // 0–1, higher = more stable/monotone
  similarityBoost: number // 0–1, higher = more similar to reference voice
  style: number           // 0–1, higher = more expressive
  useSpeakerBoost: boolean
}

export interface GenerateOptions {
  text: string
  emotion: Emotion
  speed: number          // 0.5–2.0
  expressiveness: number // 0–1
  voiceId?: string
  language?: Language
  provider?: TTSProvider
}

export interface GenerateResult {
  audioBuffer: Buffer
  mimeType: string
  durationEstimate?: number
}

export interface HistoryItem {
  id: string
  inputText: string
  textPreview: string
  selectedEmotion: Emotion
  speed: number
  expressiveness: number
  language: Language
  audioFilePath: string
  audioUrl: string
  provider: TTSProvider
  voiceId: string
  createdAt: string
}

export interface VoiceProfile {
  id: string
  name: string
  voiceId: string         // provider voice ID
  referenceFiles: string[] // paths to uploaded reference audio
  provider: TTSProvider
  createdAt: string
}
