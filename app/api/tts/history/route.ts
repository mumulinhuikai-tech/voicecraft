import { NextRequest, NextResponse } from 'next/server'
import { getHistory, deleteHistoryItem, clearHistory } from '@/lib/storage/history'

export async function GET() {
  try {
    const history = getHistory()
    return NextResponse.json({ history })
  } catch (error) {
    console.error('[History GET]', error)
    return NextResponse.json({ error: 'Failed to load history.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (id === 'all') {
      clearHistory()
      return NextResponse.json({ success: true })
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter.' }, { status: 400 })
    }

    const deleted = deleteHistoryItem(id)
    if (!deleted) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[History DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete history item.' }, { status: 500 })
  }
}
