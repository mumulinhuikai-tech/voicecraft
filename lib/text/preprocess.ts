import { normalizeChinese, insertChinesePauses, detectLanguage, isChinese } from './chinese'
import type { Language } from '@/types/tts'

export interface PreprocessOptions {
  expressiveness: number // 0–1
  emotion?: string
}

export interface PreprocessResult {
  processedText: string
  language: Language
  chunkCount: number
  wordCount: number
}

/**
 * Main text preprocessing pipeline.
 * Runs text through normalization, language detection,
 * and Chinese-specific processing before TTS generation.
 */
export function preprocessText(
  rawText: string,
  options: PreprocessOptions
): PreprocessResult {
  let text = rawText

  // 1. Basic normalization
  text = text.trim()
  text = text.replace(/\r\n/g, '\n') // normalize line endings

  // 2. Language detection
  const language = detectLanguage(text)

  // 3. Language-specific normalization
  if (language === 'zh' || language === 'mixed') {
    text = normalizeChinese(text)
    text = insertChinesePauses(text, options.expressiveness)
  } else {
    // English: just clean up extra spaces
    text = text.replace(/[ \t]+/g, ' ')
    text = text.replace(/\n{3,}/g, '\n\n')
  }

  // 4. Count words (rough estimate)
  const wordCount = language === 'zh'
    ? (text.match(/[\u4e00-\u9fff]/g) || []).length
    : text.split(/\s+/).filter(Boolean).length

  return {
    processedText: text,
    language,
    chunkCount: 1, // Single chunk for MVP; extend with chunkText() for long text
    wordCount,
  }
}

/** Generate a readable preview of the text (first ~80 chars) */
export function getTextPreview(text: string, maxLen = 80): string {
  const cleaned = text.replace(/\n+/g, ' ').trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen) + '…'
}
