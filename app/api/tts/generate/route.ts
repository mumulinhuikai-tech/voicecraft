import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/tts/provider'
import { preprocessText, getTextPreview } from '@/lib/text/preprocess'
import type { Emotion, Language, TTSProvider } from '@/types/tts'

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
    if (text.length > 10000) {
      return NextResponse.json({ error: '文字过长，最多支持 10,000 字。' }, { status: 400 })
    }

    const { processedText, language } = preprocessText(text, { expressiveness, emotion })
    const provider = getProvider(providerName)
    const result = await provider.generateSpeech({
      text: processedText,
      emotion,
      speed,
      expressiveness,
      voiceId,
      language: language as Language,
    })

    // Return metadata in headers, audio as binary body
    const id = crypto.randomUUID()
    const textPreview = getTextPreview(text)

    return new NextResponse(result.audioBuffer.buffer.slice(result.audioBuffer.byteOffset, result.audioBuffer.byteOffset + result.audioBuffer.byteLength) as ArrayBuffer, {
      headers: {
        'Content-Type': result.mimeType,
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
