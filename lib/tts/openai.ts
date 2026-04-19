import type { TTSProviderInterface } from './types'
import type { GenerateOptions, GenerateResult, VoiceProfile } from '@/types/tts'

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech'

// tts-1: faster & cheaper ($15/1M chars); tts-1-hd: better quality ($30/1M chars)
const MODEL = 'tts-1'

// Best voice for Chinese: nova or shimmer (female), onyx (male)
const DEFAULT_VOICE = 'nova'

export class OpenAITTSProvider implements TTSProviderInterface {
  readonly providerName = 'openai'
  private apiKey: string

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('OpenAI API key is required')
    this.apiKey = apiKey
  }

  async generateSpeech(options: GenerateOptions): Promise<GenerateResult> {
    const speed = Math.max(0.25, Math.min(4.0, options.speed ?? 1.0))
    const voice = options.voiceId || DEFAULT_VOICE

    const body = {
      model: MODEL,
      input: options.text,
      voice,
      speed,
      response_format: 'mp3',
    }

    const response = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new OpenAITTSError(
        `OpenAI TTS error ${response.status}: ${errorText}`,
        response.status
      )
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())
    return { audioBuffer, mimeType: 'audio/mpeg' }
  }

  async createVoiceProfile(): Promise<VoiceProfile> {
    throw new Error('OpenAI TTS does not support voice cloning.')
  }

  async listVoices() {
    return [
      { id: 'alloy', name: 'Alloy（中性）' },
      { id: 'echo', name: 'Echo（男声）' },
      { id: 'fable', name: 'Fable（男声）' },
      { id: 'onyx', name: 'Onyx（男声低沉）' },
      { id: 'nova', name: 'Nova（女声）' },
      { id: 'shimmer', name: 'Shimmer（女声柔和）' },
    ]
  }
}

export class OpenAITTSError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
    this.name = 'OpenAITTSError'
  }
}
