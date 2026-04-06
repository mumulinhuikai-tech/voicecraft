'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const STATE_CONFIG: Record<string, { color: string; bg: string }> = {
  ALIVE:   { color: '#4ade80', bg: '#0d4a1f' },
  DEAD:    { color: '#ef4444', bg: '#1a0505' },
  NPC:     { color: '#a5b4fc', bg: '#1a1a2e' },
  GRACE:   { color: '#e9d5ff', bg: '#1c1230' },
  CROWNED: { color: '#fde68a', bg: '#2d1a00' },
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [scoreInput, setScoreInput] = useState<Record<string, string>>({})
  const [teamScoreInput, setTeamScoreInput] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel('admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_events' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchData = async () => {
    const [p, t, e] = await Promise.all([
      supabase.from('players').select('*').order('score', { ascending: false }),
      supabase.from('teams').select('*'),
      supabase.from('game_events').select('*').order('created_at', { ascending: false }).limit(20),
    ])
    setPlayers(p.data || [])
    setTeams(t.data || [])
    setEvents(e.data || [])
    setLoading(false)
  }

  const setPlayerState = async (playerId: string, state: string) => {
    const updates: any = { state }
    if (state === 'GRACE') {
      updates.time_bank_is_infinite = true
      updates.time_bank_seconds = null
    } else {
      updates.time_bank_is_infinite = false
    }
    await supabase.from('players').update(updates).eq('id', playerId)
    await supabase.from('game_events').insert({
      event_type: 'ADMIN_ACTION',
      player_id: playerId,
      title: `管理员将玩家状态改为 ${state}`,
    })
    fetchData()
    setSelected(null)
  }

  const addTime = async (playerId: string, seconds: number) => {
    const player = players.find(p => p.id === playerId)
    if (!player) return
    const lastUpdated = player.time_last_updated ? new Date(player.time_last_updated).getTime() : Date.now()
    const elapsed = Math.floor((Date.now() - lastUpdated) / 1000)
    const current = Math.max(0, (player.time_bank_seconds ?? 0) - elapsed)
    const newTime = Math.max(0, current + seconds)
    const { error } = await supabase.from('players').update({
      time_bank_seconds: newTime,
      time_last_updated: new Date().toISOString(),
    }).eq('id', playerId)
    if (error) { alert('加时间失败: ' + error.message); return }
    fetchData()
  }

  const addPlayerScore = async (playerId: string) => {
    const val = parseInt(scoreInput[playerId] || '0')
    if (isNaN(val) || val === 0) return
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_player_score', id: playerId, value: val }),
    })
    const data = await res.json()
    if (data.error) { alert('积分更新失败: ' + data.error); return }
    setScoreInput(s => ({ ...s, [playerId]: '' }))
    fetchData()
  }

  const addTeamScore = async (teamId: string) => {
    const val = parseInt(teamScoreInput[teamId] || '0')
    if (isNaN(val) || val === 0) return
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_team_score', id: teamId, value: val }),
    })
    const data = await res.json()
    if (data.error) { alert('队伍积分更新失败: ' + data.error); return }
    setTeamScoreInput(s => ({ ...s, [teamId]: '' }))
    fetchData()
  }

  if (!authed) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#060810',flexDirection:'column',gap:16}}>
      <div style={{fontSize:20,fontWeight:700,color:'#00e5ff',letterSpacing:3}}>ADMIN</div>
      <input
        type="password"
        placeholder="请输入密码"
        value={pwInput}
        onChange={e => { setPwInput(e.target.value); setPwError(false) }}
        onKeyDown={e => { if (e.key === 'Enter') { if (pwInput === '0619') setAuthed(true); else setPwError(true) }}}
        style={{padding:'10px 16px',borderRadius:8,background:'#0c1020',border:`1px solid ${pwError?'#ef4444':'#1e2a3a'}`,color:'#c8d8e8',fontSize:16,outline:'none',width:200,textAlign:'center'}}
        autoFocus
      />
      {pwError && <div style={{color:'#ef4444',fontSize:13}}>密码错误</div>}
      <button onClick={() => { if (pwInput === '0619') setAuthed(true); else setPwError(true) }}
        style={{padding:'8px 24px',borderRadius:8,background:'rgba(0,229,255,0.1)',border:'1px solid #00e5ff44',color:'#00e5ff',fontWeight:700,cursor:'pointer',fontSize:14}}>
        进入
      </button>
    </div>
  )

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#060810',color:'#00e5ff',fontFamily:'monospace'}}>
      Loading...
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#060810',color:'#c8d8e8',fontFamily:'sans-serif',padding:20}}>
      <h1 style={{fontSize:24,fontWeight:900,color:'#00e5ff',letterSpacing:3,marginBottom:20}}>⚔ Camp Game — Admin</h1>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          { label:'Alive', state:'ALIVE', color:'#4ade80' },
          { label:'Dead', state:'DEAD', color:'#ef4444' },
          { label:'Grace', state:'GRACE', color:'#c084fc' },
          { label:'NPC', state:'NPC', color:'#a5b4fc' },
        ].map(s => (
          <div key={s.state} style={{background:'#0c1020',border:'1px solid #1e2a3a',borderRadius:12,padding:16,textAlign:'center'}}>
            <div style={{fontSize:28,fontWeight:700,color:s.color}}>{players.filter(p=>p.state===s.state).length}</div>
            <div style={{fontSize:11,color:'#4a6278',letterSpacing:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Players */}
        <div style={{background:'#0c1020',border:'1px solid #1e2a3a',borderRadius:12,padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#00e5ff',letterSpacing:2,marginBottom:12}}>PLAYERS</div>
          {players.map(p => {
            const cfg = STATE_CONFIG[p.state] || STATE_CONFIG.ALIVE
            const team = teams.find(t => t.id === p.team_id)
            return (
              <div key={p.id} style={{background:'#111827',border:`1px solid ${cfg.color}33`,borderRadius:8,padding:12,marginBottom:8,cursor:'pointer'}}
                onClick={() => setSelected(selected?.id === p.id ? null : p)}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15}}>{p.name}</div>
                    {team && <div style={{fontSize:11,color:team.color}}>{team.emblem} {team.name}</div>}
                    {p.state === 'ALIVE' && (
                      <div style={{fontSize:11,color:'#4a6278',fontFamily:'monospace',marginTop:2}}>
                        ⏱ {p.time_bank_is_infinite ? '∞' : p.time_bank_seconds != null ? `${Math.floor(p.time_bank_seconds/3600)}h ${Math.floor((p.time_bank_seconds%3600)/60)}m` : '无时间'}
                      </div>
                    )}
                  </div>
                  <span style={{padding:'3px 8px',borderRadius:4,background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}`,fontSize:10,fontWeight:700}}>
                    {p.state}
                  </span>
                </div>

                {/* Expanded controls */}
                {selected?.id === p.id && (
                  <div style={{marginTop:12,borderTop:'1px solid #1e2a3a',paddingTop:12}}>
                    
                    {/* State buttons */}
                    <div style={{fontSize:11,color:'#4a6278',marginBottom:6}}>状态变更</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                      {Object.keys(STATE_CONFIG).map(s => (
                        <button key={s} onClick={(e) => { e.stopPropagation(); setPlayerState(p.id, s) }}
                          style={{padding:'4px 10px',borderRadius:6,background:STATE_CONFIG[s].bg,color:STATE_CONFIG[s].color,border:`1px solid ${STATE_CONFIG[s].color}`,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                          {s}
                        </button>
                      ))}
                    </div>

                    {/* Time controls */}
                    <div style={{fontSize:11,color:'#4a6278',marginBottom:6}}>时间操作</div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                      {[
                        { label:'+1小时', val:3600 },
                        { label:'+30分', val:1800 },
                        { label:'-30分', val:-1800 },
                        { label:'-1小时', val:-3600 },
                      ].map(btn => (
                        <button key={btn.label} onClick={(e) => { e.stopPropagation(); addTime(p.id, btn.val) }}
                          style={{padding:'4px 10px',borderRadius:6,background:btn.val>0?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)',color:btn.val>0?'#4ade80':'#ef4444',border:`1px solid ${btn.val>0?'#4ade8044':'#ef444444'}`,fontSize:11,fontWeight:700,cursor:'pointer'}}>
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    {/* Player score */}
                    <div style={{fontSize:11,color:'#4a6278',marginBottom:6}}>个人积分（当前：{p.score}）</div>
                    <div style={{display:'flex',gap:6}} onClick={e => e.stopPropagation()}>
                      <input
                        type="number"
                        placeholder="输入积分（负数可扣分）"
                        value={scoreInput[p.id] || ''}
                        onChange={e => setScoreInput(s => ({ ...s, [p.id]: e.target.value }))}
                        style={{flex:1,padding:'4px 8px',borderRadius:6,background:'#0c1020',border:'1px solid #1e2a3a',color:'#c8d8e8',fontSize:12}}
                      />
                      <button onClick={() => addPlayerScore(p.id)}
                        style={{padding:'4px 10px',borderRadius:6,background:'rgba(0,229,255,0.1)',border:'1px solid #00e5ff44',color:'#00e5ff',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                        确认
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Right column */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>

        {/* Team scores */}
        <div style={{background:'#0c1020',border:'1px solid #1e2a3a',borderRadius:12,padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#00e5ff',letterSpacing:2,marginBottom:12}}>TEAM SCORES</div>
          {teams.map(t => (
            <div key={t.id} style={{marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span>{t.emblem}</span>
                  <span style={{fontWeight:700,color:t.color,fontSize:13}}>{t.name}</span>
                </div>
                <span style={{fontFamily:'monospace',color:t.color,fontSize:16,fontWeight:700}}>{t.score}</span>
              </div>
              <div style={{display:'flex',gap:6}}>
                <input
                  type="number"
                  placeholder="输入积分（负数可扣分）"
                  value={teamScoreInput[t.id] || ''}
                  onChange={e => setTeamScoreInput(s => ({ ...s, [t.id]: e.target.value }))}
                  style={{flex:1,padding:'4px 8px',borderRadius:6,background:'#111827',border:'1px solid #1e2a3a',color:'#c8d8e8',fontSize:12}}
                />
                <button onClick={() => addTeamScore(t.id)}
                  style={{padding:'4px 10px',borderRadius:6,background:'rgba(0,229,255,0.1)',border:'1px solid #00e5ff44',color:'#00e5ff',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                  确认
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Events */}
        <div style={{background:'#0c1020',border:'1px solid #1e2a3a',borderRadius:12,padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:'#00e5ff',letterSpacing:2,marginBottom:12}}>LIVE EVENTS</div>
          <div style={{maxHeight:500,overflowY:'auto'}}>
            {events.map(e => (
              <div key={e.id} style={{background:'#111827',borderRadius:8,padding:10,marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:12}}>{e.title}</div>
                {e.description && <div style={{fontSize:11,color:'#4a6278',marginTop:2}}>{e.description}</div>}
              </div>
            ))}
            {events.length === 0 && <div style={{color:'#4a6278',fontSize:12,textAlign:'center',padding:20}}>暂无事件</div>}
          </div>
        </div>

        </div>
      </div>
    </div>
  )
}