import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { action, id, value } = await req.json()

  if (action === 'add_team_score') {
    const { data: team, error: fetchError } = await supabaseAdmin
      .from('teams').select('score').eq('id', id).single()
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })
    const { error } = await supabaseAdmin
      .from('teams').update({ score: (team.score || 0) + value }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'add_player_score') {
    const { data: player, error: fetchError } = await supabaseAdmin
      .from('players').select('score').eq('id', id).single()
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 })
    const { error } = await supabaseAdmin
      .from('players').update({ score: (player.score || 0) + value }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
