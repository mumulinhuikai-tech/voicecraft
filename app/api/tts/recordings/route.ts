import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const RECORDINGS_DIR = path.join(process.cwd(), 'data', 'recordings')
const META_FILE = path.join(process.cwd(), 'data', 'recordings-meta.json')

interface RecordingMeta {
  id: string
  name: string
  filename: string
  size: number
  duration: number
  createdAt: string
}

function ensureDir() {
  if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
}

function readMeta(): RecordingMeta[] {
  if (!fs.existsSync(META_FILE)) return []
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf-8')) } catch { return [] }
}

function writeMeta(items: RecordingMeta[]) {
  fs.writeFileSync(META_FILE, JSON.stringify(items, null, 2), 'utf-8')
}

/** GET — list saved recordings */
export async function GET() {
  const items = readMeta()
  // Filter out entries whose files have been deleted
  const existing = items.filter((r) => fs.existsSync(path.join(RECORDINGS_DIR, r.filename)))
  return NextResponse.json({ recordings: existing })
}

/** POST — save a new recording */
export async function POST(req: NextRequest) {
  try {
    ensureDir()
    const formData = await req.formData()
    const file = formData.get('file') as File
    const name = (formData.get('name') as string) || '未命名录音'
    const duration = parseFloat((formData.get('duration') as string) || '0')

    if (!file) return NextResponse.json({ error: '缺少音频文件' }, { status: 400 })

    const id = crypto.randomUUID()
    const ext = file.name.endsWith('.wav') ? '.wav' : '.webm'
    const filename = `${id}${ext}`
    const filePath = path.join(RECORDINGS_DIR, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    const meta: RecordingMeta = {
      id, name, filename,
      size: buffer.length,
      duration,
      createdAt: new Date().toISOString(),
    }

    const items = readMeta()
    items.unshift(meta)
    writeMeta(items)

    return NextResponse.json({ success: true, recording: meta })
  } catch (err) {
    console.error('[Recordings POST]', err)
    return NextResponse.json({ error: '保存失败' }, { status: 500 })
  }
}

/** DELETE — remove a recording */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const items = readMeta()
  const item = items.find((r) => r.id === id)
  if (item) {
    const filePath = path.join(RECORDINGS_DIR, item.filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }
  writeMeta(items.filter((r) => r.id !== id))
  return NextResponse.json({ success: true })
}
