/**
 * TTS Provider factory.
 *
 * To add a new provider:
 * 1. Implement TTSProviderInterface in a new file (e.g., lib/tts/cartesia.ts)
 * 2. Add a case here in getProvider()
 * 3. Add the required env variables to .env.local
 */

import { ElevenLabsProvider } from './elevenlabs'
import type { TTSProviderInterface } from './types'
import type { TTSProvider } from '@/types/tts'

export function getProvider(providerName: TTSProvider = 'elevenlabs'): TTSProviderInterface {
  switch (providerName) {
    case 'elevenlabs': {
      const apiKey = process.env.ELEVENLABS_API_KEY
      const voiceId = process.env.ELEVENLABS_VOICE_ID || ''
      if (!apiKey) {
        throw new Error(
          'ELEVENLABS_API_KEY is not set. Add it to your .env.local file.'
        )
      }
      return new ElevenLabsProvider(apiKey, voiceId)
    }

    // Future providers — implement and uncomment when ready
    // case 'cartesia': {
    //   const apiKey = process.env.CARTESIA_API_KEY
    //   if (!apiKey) throw new Error('CARTESIA_API_KEY is not set')
    //   return new CartesiaProvider(apiKey)
    // }
    // case 'openai': {
    //   const apiKey = process.env.OPENAI_API_KEY
    //   if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
    //   return new OpenAITTSProvider(apiKey)
    // }

    default:
      throw new Error(`Unknown TTS provider: ${providerName}`)
  }
}
