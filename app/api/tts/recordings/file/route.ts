import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const RECORDINGS_DIR = path.join(process.cwd(), 'data', 'recordings')

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filename = searchParams.get('filename')

  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: '无效文件名' }, { status: 400 })
  }

  const filePath = path.join(RECORDINGS_DIR, filename)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 })
  }

  const buffer = fs.readFileSync(filePath)
  const ext = path.extname(filename).toLowerCase()
  const mimeType = ext === '.wav' ? 'audio/wav' : ext === '.ogg' ? 'audio/ogg' : 'audio/webm'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
    },
  })
}
