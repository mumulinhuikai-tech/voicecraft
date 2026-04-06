import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/tts/provider'

const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/wave', 'audio/webm', 'audio/ogg',
]

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const name = formData.get('name') as string
    const files = formData.getAll('files') as File[]

    if (!name?.trim()) {
      return NextResponse.json({ error: '请填写声音名称。' }, { status: 400 })
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ error: '请上传至少一个音频文件。' }, { status: 400 })
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type) &&
          !['.mp3', '.wav', '.webm', '.ogg'].some((e) => file.name.toLowerCase().endsWith(e))) {
        return NextResponse.json(
          { error: `不支持的文件格式：${file.type}，请使用 mp3、wav 或 webm。` },
          { status: 400 }
        )
      }
    }

    const audioBuffers = await Promise.all(files.map((f) => f.arrayBuffer().then(Buffer.from)))
    const provider = getProvider('elevenlabs')
    const profile = await provider.createVoiceProfile(name, audioBuffers, name)

    return NextResponse.json({ success: true, voiceId: profile.voiceId, name: profile.name })
  } catch (error: unknown) {
    console.error('[Voice Profile POST]', error)
    if (error instanceof Error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ error: '创建声音失败。' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const provider = getProvider('elevenlabs')
    const voices = await provider.listVoices()
    return NextResponse.json({ voices })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json({ voices: [] })
    }
    return NextResponse.json({ voices: [] })
  }
}
