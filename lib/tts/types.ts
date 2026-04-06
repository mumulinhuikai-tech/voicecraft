import type { GenerateOptions, GenerateResult, VoiceProfile } from '@/types/tts'

/**
 * Abstract TTS provider interface.
 * Swap providers by implementing this interface.
 */
export interface TTSProviderInterface {
  /** Generate speech audio from text with given options */
  generateSpeech(options: GenerateOptions): Promise<GenerateResult>

  /**
   * Create a voice profile from reference audio files.
   * Returns a provider-specific voice ID.
   * NOTE: Not all providers support instant voice cloning in MVP.
   */
  createVoiceProfile(
    name: string,
    audioFiles: Buffer[],
    description?: string
  ): Promise<VoiceProfile>

  /** List available voices from the provider */
  listVoices(): Promise<Array<{ id: string; name: string; description?: string }>>

  /** Provider name identifier */
  readonly providerName: string
}
