import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  const playerId = searchParams.get('player_id')

  if (sessionId && playerId) {
    // Check if player already responded
    const { data } = await supabaseAdmin
      .from('game_responses')
      .select('id, value')
      .eq('session_id', sessionId)
      .eq('player_id', playerId)
      .maybeSingle()
    return NextResponse.json({ response: data })
  }

  if (searchParams.get('all') === '1') {
    // Admin: get all sessions
    const { data } = await supabaseAdmin
      .from('game_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    return NextResponse.json({ sessions: data || [] })
  }

  // Get active session + responses
  const { data: session } = await supabaseAdmin
    .from('game_sessions')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!session) return NextResponse.json({ session: null, responses: [] })

  const { data: responses } = await supabaseAdmin
    .from('game_responses')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ session, responses: responses || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  if (action === 'create') {
    const { type, title, question, options, duration_seconds } = body
    const { data, error } = await supabaseAdmin
      .from('game_sessions')
      .insert({ type, title, question, options: options || null, duration_seconds: duration_seconds || 15, status: 'waiting' })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ session: data })
  }

  if (action === 'activate') {
    const { id } = body
    await supabaseAdmin.from('game_sessions').update({ status: 'ended' }).eq('status', 'active')
    const { data, error } = await supabaseAdmin
      .from('game_sessions')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ session: data })
  }

  if (action === 'end') {
    const { id } = body
    const { error } = await supabaseAdmin
      .from('game_sessions').update({ status: 'ended' }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'respond') {
    const { session_id, player_id, player_name, value } = body
    // Check existing
    const { data: existing } = await supabaseAdmin
      .from('game_responses')
      .select('id')
      .eq('session_id', session_id)
      .eq('player_id', player_id)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: 'already_responded' }, { status: 400 })
    const { error } = await supabaseAdmin
      .from('game_responses')
      .insert({ session_id, player_id, player_name, value })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    const { id } = body
    await supabaseAdmin.from('game_responses').delete().eq('session_id', id)
    const { error } = await supabaseAdmin.from('game_sessions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
