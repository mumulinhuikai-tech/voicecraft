/**
 * Chinese text processing utilities.
 *
 * Handles segmentation, pause insertion, and normalization
 * for more natural Chinese TTS output.
 *
 * Future extension points:
 * - Custom pause markers (<pause ms="500"/>)
 * - Phrase emphasis tagging
 * - Sermon/teaching cadence presets
 * - Polyphone disambiguation
 */

/** Chinese punctuation that indicates a short pause */
const SHORT_PAUSE_CHARS = new Set(['，', '、', '：', '；'])

/** Chinese punctuation that indicates a long pause */
const LONG_PAUSE_CHARS = new Set(['。', '！', '？', '…', '……'])

/** Detect if a string contains a significant proportion of Chinese characters */
export function isChinese(text: string): boolean {
  const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []
  return chineseChars.length / text.length > 0.2
}

/** Detect if text is primarily Chinese */
export function detectLanguage(text: string): 'zh' | 'en' | 'mixed' {
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const totalChars = text.replace(/\s/g, '').length
  if (totalChars === 0) return 'en'
  const ratio = chineseChars / totalChars
  if (ratio > 0.6) return 'zh'
  if (ratio > 0.1) return 'mixed'
  return 'en'
}

/**
 * Segment Chinese text into natural speech chunks.
 * Each chunk is a sentence or clause that should be read as a unit.
 */
export function segmentChineseText(text: string): string[] {
  if (!text.trim()) return []

  // Split on sentence-ending punctuation, keeping the delimiter
  const segments: string[] = []
  let current = ''

  for (const char of text) {
    current += char
    if (LONG_PAUSE_CHARS.has(char)) {
      const trimmed = current.trim()
      if (trimmed) segments.push(trimmed)
      current = ''
    }
  }

  // Push any remaining text
  if (current.trim()) segments.push(current.trim())

  return segments.filter(Boolean)
}

/**
 * Insert pause hints into text for better TTS rhythm.
 * For providers that support SSML or break tags, this can be
 * extended to produce proper SSML markup.
 *
 * Currently outputs plain text with strategic spacing,
 * which ElevenLabs handles via punctuation interpretation.
 */
export function insertChinesePauses(
  text: string,
  expressiveness: number // 0–1, higher = more exaggerated pauses
): string {
  if (!isChinese(text)) return text

  let result = text

  // Normalize Chinese ellipsis
  result = result.replace(/……/g, '…')

  // For high expressiveness, add extra whitespace after long-pause punctuation
  // to hint at the TTS engine to extend the pause
  if (expressiveness > 0.6) {
    result = result.replace(/([。！？…])/g, '$1 ')
  }

  return result
}

/**
 * Normalize Chinese text for better TTS rendering.
 * - Normalize full-width punctuation
 * - Remove redundant whitespace
 * - Ensure paragraph breaks are preserved
 */
export function normalizeChinese(text: string): string {
  let result = text

  // Normalize full-width to half-width for numbers/letters (keep Chinese punctuation)
  result = result.replace(/[\uff01-\uff5e]/g, (char) => {
    // Only convert if it's a letter or digit, not Chinese punctuation
    const code = char.charCodeAt(0) - 0xfee0
    const halfWidth = String.fromCharCode(code)
    if (/[a-zA-Z0-9]/.test(halfWidth)) return halfWidth
    return char
  })

  // Normalize multiple spaces to single space (but preserve newlines)
  result = result.replace(/[ \t]+/g, ' ')

  // Normalize multiple newlines to at most double newline
  result = result.replace(/\n{3,}/g, '\n\n')

  return result.trim()
}

/**
 * Split long text into chunks suitable for a single TTS API call.
 * ElevenLabs recommends keeping requests under ~2500 characters.
 */
export function chunkText(text: string, maxChars = 2000): string[] {
  if (text.length <= maxChars) return [text]

  const segments = segmentChineseText(text)
  const chunks: string[] = []
  let currentChunk = ''

  for (const segment of segments) {
    if ((currentChunk + segment).length > maxChars && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = segment
    } else {
      currentChunk += (currentChunk ? ' ' : '') + segment
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim())

  return chunks.length > 0 ? chunks : [text]
}
