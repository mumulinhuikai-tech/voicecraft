import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/tts/provider'
import { preprocessText, getTextPreview } from '@/lib/text/preprocess'
import type { Emotion, Language, TTSProvider } from '@/types/tts'

// Extend Vercel function timeout to 60s (Hobby plan max)
export const maxDuration = 60

// ElevenLabs multilingual_v2 limit is 5000 chars per call
const CHUNK_SIZE = 2000
// Max concurrent ElevenLabs requests to avoid rate limiting
const MAX_CONCURRENCY = 3

function splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) return [text]

  const chunks: string[] = []
  // Split on sentence boundaries (。！？.!?\n) to avoid cutting mid-sentence
  const sentencePattern = /[。！？.!?\n]+/g
  const sentences: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = sentencePattern.exec(text)) !== null) {
    sentences.push(text.slice(lastIndex, match.index + match[0].length))
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) sentences.push(text.slice(lastIndex))

  let current = ''
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks.length > 0 ? chunks : [text.slice(0, maxChunkSize)]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      text,
      emotion = 'calm',
      speed = 1.0,
      expressiveness = 0.5,
      voiceId,
      providerName = 'elevenlabs',
    } = body as {
      text: string
      emotion: Emotion
      speed: number
      expressiveness: number
      voiceId?: string
      providerName?: TTSProvider
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: '请输入文字内容。' }, { status: 400 })
    }
    if (text.length > 40000) {
      return NextResponse.json({ error: '文字过长，最多支持 40,000 字。' }, { status: 400 })
    }

    const { processedText, language } = preprocessText(text, { expressiveness, emotion })
    const provider = getProvider(providerName)

    const chunks = splitTextIntoChunks(processedText, CHUNK_SIZE)

    // Generate chunks with limited concurrency to avoid rate limiting
    const audioBuffers: Buffer[] = new Array(chunks.length)
    for (let i = 0; i < chunks.length; i += MAX_CONCURRENCY) {
      const batch = chunks.slice(i, i + MAX_CONCURRENCY)
      const batchResults = await Promise.all(
        batch.map(chunk =>
          provider.generateSpeech({
            text: chunk,
            emotion,
            speed,
            expressiveness,
            voiceId,
            language: language as Language,
          })
        )
      )
      batchResults.forEach((r, j) => { audioBuffers[i + j] = r.audioBuffer })
    }

    // Concatenate all audio buffers
    const combined = Buffer.concat(audioBuffers)

    const id = crypto.randomUUID()
    const textPreview = getTextPreview(text)

    return new NextResponse(combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength) as ArrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="voicecraft_${id.slice(0, 8)}.mp3"`,
        'X-Generation-Id': id,
        'X-Text-Preview': encodeURIComponent(textPreview),
        'X-Language': language,
      },
    })
  } catch (error: unknown) {
    console.error('[TTS Generate]', error)
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json({ error: '未配置 TTS 服务密钥，请检查环境变量。' }, { status: 503 })
      }
      const asAny = error as { statusCode?: number }
      if (asAny.statusCode === 401) return NextResponse.json({ error: 'API 密钥无效，请检查配置。' }, { status: 401 })
      if (asAny.statusCode === 429) return NextResponse.json({ error: '请求过于频繁，请稍后再试。' }, { status: 429 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: '生成失败，请重试。' }, { status: 500 })
  }
}
