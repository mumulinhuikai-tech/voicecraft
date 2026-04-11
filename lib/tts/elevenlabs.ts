import type { TTSProviderInterface } from './types'
import type { GenerateOptions, GenerateResult, VoiceProfile } from '@/types/tts'
import { getEmotionSettings } from '@/lib/text/emotion-mapping'

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1'

// eleven_turbo_v2_5: faster, better Chinese pronunciation than multilingual_v2
const DEFAULT_MODEL = 'eleven_turbo_v2_5'

export class ElevenLabsProvider implements TTSProviderInterface {
  readonly providerName = 'elevenlabs'

  private apiKey: string
  private defaultVoiceId: string

  constructor(apiKey: string, defaultVoiceId: string) {
    if (!apiKey) throw new Error('ElevenLabs API key is required')
    this.apiKey = apiKey
    this.defaultVoiceId = defaultVoiceId || 'EXAVITQu4vr4xnSDxMaL' // "Sarah" as fallback
  }

  async generateSpeech(options: GenerateOptions): Promise<GenerateResult> {
    const voiceId = options.voiceId || this.defaultVoiceId
    const emotionSettings = getEmotionSettings(options.emotion)

    // Blend emotion voice settings with user expressiveness control
    // expressiveness (0–1) adjusts the style intensity
    const styleIntensity = emotionSettings.style * options.expressiveness
    const stabilityAdjusted = emotionSettings.stability + (1 - options.expressiveness) * 0.15

    const voiceSettings = {
      stability: Math.min(1, Math.max(0, stabilityAdjusted)),
      similarity_boost: emotionSettings.similarityBoost,
      style: Math.min(1, Math.max(0, styleIntensity)),
      use_speaker_boost: emotionSettings.useSpeakerBoost,
    }

    // ElevenLabs does not have a direct "speed" parameter in the v1 API.
    // Speed control is achieved by using the speech_synthesis_result or
    // the newer /v1/text-to-speech endpoint with model-specific params.
    // For now we note this limitation and prepare the architecture.
    // TODO: When ElevenLabs adds native speed control, plug it in here.

    const body = {
      text: options.text,
      model_id: DEFAULT_MODEL,
      voice_settings: voiceSettings,
      // Seed for reproducibility (optional)
      // seed: 42,
    }

    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new ElevenLabsError(
        `ElevenLabs API error ${response.status}: ${errorText}`,
        response.status
      )
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer())

    return {
      audioBuffer,
      mimeType: 'audio/mpeg',
    }
  }

  async createVoiceProfile(
    name: string,
    audioFiles: Buffer[],
    description?: string
  ): Promise<VoiceProfile> {
    // ElevenLabs instant voice cloning via /v1/voices/add
    const formData = new FormData()
    formData.append('name', name)
    if (description) formData.append('description', description)

    audioFiles.forEach((buffer, i) => {
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
      formData.append('files', blob, `sample_${i + 1}.mp3`)
    })

    const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new ElevenLabsError(
        `Failed to create voice profile: ${errorText}`,
        response.status
      )
    }

    const data = await response.json()

    return {
      id: data.voice_id,
      name,
      voiceId: data.voice_id,
      referenceFiles: [],
      provider: 'elevenlabs',
      createdAt: new Date().toISOString(),
    }
  }

  async listVoices(): Promise<Array<{ id: string; name: string; description?: string }>> {
    const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: { 'xi-api-key': this.apiKey },
    })

    if (!response.ok) {
      throw new ElevenLabsError(`Failed to list voices: ${response.status}`, response.status)
    }

    const data = await response.json()
    return (data.voices || []).map((v: { voice_id: string; name: string; description?: string }) => ({
      id: v.voice_id,
      name: v.name,
      description: v.description,
    }))
  }
}

export class ElevenLabsError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
    this.name = 'ElevenLabsError'
  }
}
