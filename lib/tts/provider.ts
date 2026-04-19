/**
 * TTS Provider factory.
 *
 * To add a new provider:
 * 1. Implement TTSProviderInterface in a new file (e.g., lib/tts/cartesia.ts)
 * 2. Add a case here in getProvider()
 * 3. Add the required env variables to .env.local
 */

import { ElevenLabsProvider } from './elevenlabs'
import { OpenAITTSProvider } from './openai'
import type { TTSProviderInterface } from './types'
import type { TTSProvider } from '@/types/tts'

// Default to OpenAI if available, fallback to ElevenLabs
function getDefaultProvider(): TTSProvider {
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'elevenlabs'
}

export function getProvider(providerName?: TTSProvider): TTSProviderInterface {
  const name = providerName || getDefaultProvider()

  switch (name) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error('OPENAI_API_KEY is not set.')
      return new OpenAITTSProvider(apiKey)
    }

    case 'elevenlabs': {
      const apiKey = process.env.ELEVENLABS_API_KEY
      const voiceId = process.env.ELEVENLABS_VOICE_ID || ''
      if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set.')
      return new ElevenLabsProvider(apiKey, voiceId)
    }

    default:
      throw new Error(`Unknown TTS provider: ${name}`)
  }
}
