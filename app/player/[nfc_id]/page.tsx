'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ALIVE:   { label: 'ALIVE',   color: '#4ade80', bg: '#0d4a1f' },
  DEAD:    { label: 'DEAD',    color: '#ef4444', bg: '#1a0505' },
  NPC:     { label: 'NPC',     color: '#a5b4fc', bg: '#1a1a2e' },
  GRACE:   { label: 'GRACE',   color: '#e9d5ff', bg: '#1c1230' },
  CROWNED: { label: 'CROWNED', color: '#fde68a', bg: '#2d1a00' },
}

const formatTime = (seconds: number) => {
  if (!seconds || seconds <= 0) return '00:00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ─── Game Widget (新的心跳 互动游戏) ──────────────────────────────────────────

function GameWidget({ session, playerId, playerName }: { session: any; playerId: string; playerName: string }) {
  const [submitted, setSubmitted] = useState(false)
  const [myResponse, setMyResponse] = useState('')
  const [pollChoice, setPollChoice] = useState<string | null>(null)
  const [wordInput, setWordInput] = useState('')
  const [scaleValue, setScaleValue] = useState(5)
  const [tapCount, setTapCount] = useState(0)
  const [raceTimeLeft, setRaceTimeLeft] = useState(0)
  const [raceStarted, setRaceStarted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const tapSubmittedRef = useRef(false)

  // Check if already responded to this session
  useEffect(() => {
    tapSubmittedRef.current = false
    setSubmitted(false)
    setMyResponse('')
    setPollChoice(null)
    setWordInput('')
    setScaleValue(5)
    setTapCount(0)
    fetch(`/api/games?session_id=${session.id}&player_id=${playerId}`)
      .then(r => r.json())
      .then(d => {
        if (d.response) {
          setSubmitted(true)
          setMyResponse(d.response.value)
          if (session.type === 'poll') setPollChoice(d.response.value)
          if (session.type === 'wordcloud') setWordInput(d.response.value)
          if (session.type === 'scale') setScaleValue(Number(d.response.value))
          if (session.type === 'race') setTapCount(Number(d.response.value))
        }
      })
  }, [session.id, playerId])

  // Race countdown + auto-submit
  useEffect(() => {
    if (session.type !== 'race' || !session.started_at || submitted) return
    const duration = session.duration_seconds || 20
    const end = new Date(session.started_at).getTime() + duration * 1000
    setRaceStarted(true)
    const update = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setRaceTimeLeft(left)
      if (left === 0 && !tapSubmittedRef.current) {
        tapSubmittedRef.current = true
        setTapCount(prev => {
          submitResponse(String(prev))
          return prev
        })
      }
    }
    update()
    const iv = setInterval(update, 200)
    return () => clearInterval(iv)
  }, [session.id, session.started_at, submitted])

  const submitResponse = async (value: string) => {
    if (submitting || submitted) return
    setSubmitting(true)
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'respond', session_id: session.id, player_id: playerId, player_name: playerName, value }),
    })
    const data = await res.json()
    if (!data.error) { setSubmitted(true); setMyResponse(value) }
    setSubmitting(false)
  }

  const typeColors: Record<string, string> = {
    poll: '#c77dff', wordcloud: '#00e5ff', scale: '#ffd60a', race: '#ff4d6d',
  }
  const accent = typeColors[session.type] || '#ff4d6d'
  const typeLabel: Record<string, string> = {
    poll: '🗳️ 全场投票', wordcloud: '☁️ 心声词云', scale: '📊 心跳刻度', race: '💓 心跳竞速',
  }

  return (
    <div style={{ background: `${accent}0d`, border: `2px solid ${accent}55`, borderRadius: 20, padding: 20, marginBottom: 20 }}>
      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .tap-btn:active { transform: scale(0.92) !important; }
      `}</style>

      <div style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: 2, marginBottom: 4 }}>
        🟢 LIVE · {typeLabel[session.type]}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 16, lineHeight: 1.4, whiteSpace: 'pre-line' }}>
        {session.question}
      </div>

      {submitted ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ fontWeight: 700, color: accent, marginTop: 4, fontSize: 16 }}>已提交！</div>
          {session.type === 'poll' && <div style={{ fontSize: 12, color: '#4a6278', marginTop: 4 }}>你选了：{myResponse}</div>}
          {session.type === 'wordcloud' && <div style={{ fontSize: 12, color: '#4a6278', marginTop: 4 }}>你写了：{myResponse}</div>}
          {session.type === 'scale' && <div style={{ fontSize: 12, color: '#4a6278', marginTop: 4 }}>你的分数：{myResponse}</div>}
          {session.type === 'race' && <div style={{ fontSize: 12, color: '#4a6278', marginTop: 4 }}>你点击了 {myResponse} 下！</div>}
        </div>
      ) : (
        <>
          {/* Poll */}
          {session.type === 'poll' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(session.options || []).map((opt: string, i: number) => (
                <button key={i} onClick={() => { setPollChoice(opt); submitResponse(opt) }}
                  disabled={submitting}
                  style={{ padding: '14px 16px', borderRadius: 12, background: pollChoice === opt ? `${accent}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${pollChoice === opt ? accent : '#1e2a3a'}`, color: pollChoice === opt ? accent : '#c8d8e8', fontWeight: 700, fontSize: 15, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Word Cloud */}
          {session.type === 'wordcloud' && (
            <div>
              <input
                value={wordInput}
                onChange={e => setWordInput(e.target.value.slice(0, 20))}
                placeholder="输入一个词..."
                maxLength={20}
                style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid #1e2a3a', color: '#e2e8f0', fontSize: 22, fontWeight: 700, outline: 'none', marginBottom: 12, textAlign: 'center' }}
                onKeyDown={e => { if (e.key === 'Enter' && wordInput.trim()) submitResponse(wordInput.trim()) }}
              />
              <button onClick={() => wordInput.trim() && submitResponse(wordInput.trim())}
                disabled={submitting || !wordInput.trim()}
                style={{ width: '100%', padding: '14px', borderRadius: 12, background: `${accent}22`, border: `1px solid ${accent}`, color: accent, fontWeight: 900, fontSize: 16, cursor: 'pointer', opacity: !wordInput.trim() ? 0.4 : 1 }}>
                提交
              </button>
            </div>
          )}

          {/* Scale */}
          {session.type === 'scale' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 64, fontWeight: 900, color: accent, fontFamily: 'monospace', lineHeight: 1 }}>{scaleValue}</span>
              </div>
              <input type="range" min={1} max={10} value={scaleValue}
                onChange={e => setScaleValue(Number(e.target.value))}
                style={{ width: '100%', accentColor: accent, height: 8, cursor: 'pointer', marginBottom: 6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a6278', marginBottom: 14 }}>
                <span>1 完全不是</span><span>10 完全是</span>
              </div>
              <button onClick={() => submitResponse(String(scaleValue))}
                disabled={submitting}
                style={{ width: '100%', padding: '14px', borderRadius: 12, background: `${accent}22`, border: `1px solid ${accent}`, color: accent, fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>
                提交 {scaleValue} 分
              </button>
            </div>
          )}

          {/* Race */}
          {session.type === 'race' && raceStarted && raceTimeLeft > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, color: raceTimeLeft <= 5 ? '#ef4444' : '#4a6278', fontFamily: 'monospace', fontWeight: 700, marginBottom: 6 }}>
                剩余 {raceTimeLeft} 秒
              </div>
              <div style={{ fontSize: 64, fontWeight: 900, color: accent, marginBottom: 16, fontFamily: 'monospace', lineHeight: 1 }}>{tapCount}</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  className="tap-btn"
                  onPointerDown={e => { e.preventDefault(); setTapCount(t => t + 1) }}
                  style={{ width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${accent}33, ${accent}11)`, border: `3px solid ${accent}`, color: accent, fontSize: 44, cursor: 'pointer', boxShadow: `0 0 30px ${accent}44`, userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.08s' }}>
                  💓
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#4a6278', marginTop: 10 }}>疯狂点击！</div>
            </div>
          )}
          {session.type === 'race' && raceStarted && raceTimeLeft === 0 && (
            <div style={{ textAlign: 'center', color: '#4a6278', padding: 16 }}>提交中...</div>
          )}
          {session.type === 'race' && !raceStarted && (
            <div style={{ textAlign: 'center', color: '#4a6278', padding: 16 }}>准备好了吗？即将开始...</div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Player Page ─────────────────────────────────────────────────────────

export default function PlayerPage() {
  const { nfc_id } = useParams()
  const [player, setPlayer] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [liveTime, setLiveTime] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [graceConfirm, setGraceConfirm] = useState(false)
  const [activeGame, setActiveGame] = useState<any>(null)

  useEffect(() => {
    fetchPlayer()
  }, [nfc_id])

  // Watch for active mini-game
  useEffect(() => {
    const fetchGame = async () => {
      const res = await fetch('/api/games')
      const data = await res.json()
      setActiveGame(data.session || null)
    }
    fetchGame()
    const ch = supabase
      .channel('player-minigame')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, fetchGame)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    if (!player || player.state !== 'ALIVE' || player.time_bank_is_infinite) return
    const elapsed = Math.floor((Date.now() - new Date(player.time_last_updated).getTime()) / 1000)
    const initial = Math.max(0, player.time_bank_seconds - elapsed)
    setLiveTime(initial)
    if (initial === 0) {
      supabase.from('players').update({ state: 'DEAD' }).eq('id', player.id).then(() => fetchPlayer())
      return
    }
    const iv = setInterval(() => {
      setLiveTime(t => {
        const next = Math.max(0, t - 1)
        if (next === 0) {
          supabase.from('players').update({ state: 'DEAD' }).eq('id', player.id).then(() => fetchPlayer())
        }
        return next
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [player])

  const fetchPlayer = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('nfc_tag_id', nfc_id)
      .single()
    if (error || !data) { setNotFound(true); setLoading(false); return }
    setPlayer(data)
    if (data.team_id) {
      const { data: t } = await supabase.from('teams').select('*').eq('id', data.team_id).single()
      setTeam(t)
    }
    setLoading(false)
  }

  const chooseGrace = async () => {
    await supabase.from('players').update({
      state: 'GRACE',
      time_bank_is_infinite: true,
      time_bank_seconds: null,
    }).eq('id', player.id)
    await supabase.from('game_events').insert({
      event_type: 'GRACE_CHOSEN',
      player_id: player.id,
      title: `${player.name} 选择了 GRACE`,
      description: '一个灵魂用时间换取了永恒',
    })
    fetchPlayer()
    setGraceConfirm(false)
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#060810',color:'#00e5ff',fontFamily:'monospace',fontSize:18}}>
      Loading...
    </div>
  )

  if (notFound) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#060810',color:'#ef4444',fontFamily:'monospace',fontSize:18,textAlign:'center'}}>
      ❌ NFC 标签未找到<br/><span style={{fontSize:12,color:'#4a6278',marginTop:8,display:'block'}}>{nfc_id}</span>
    </div>
  )

  const cfg = STATE_CONFIG[player.state] || STATE_CONFIG.ALIVE
  const timePct = player.time_bank_is_infinite ? 100 : Math.min(100, (liveTime / 43200) * 100)
  const timeColor = liveTime < 3600 ? '#ef4444' : liveTime < 7200 ? '#f59e0b' : cfg.color

  return (
    <div style={{minHeight:'100vh',background:'#060810',color:'#c8d8e8',fontFamily:'sans-serif',padding:24,maxWidth:520,margin:'0 auto'}}>

      {/* Header */}
      <div style={{marginBottom:24,textAlign:'center'}}>
        <div style={{fontSize:13,letterSpacing:3,color:'#4a6278',textTransform:'uppercase'}}>Player Status</div>
        <div style={{fontSize:36,fontWeight:900,color:cfg.color,letterSpacing:2}}>{player.name}</div>
      </div>

      {/* 💓 Live Mini-Game Widget — appears only when admin launches a game */}
      {activeGame && (
        <GameWidget
          session={activeGame}
          playerId={String(nfc_id)}
          playerName={player.name}
        />
      )}

      {/* State + Timer */}
      <div style={{background:cfg.bg,border:`1px solid ${cfg.color}44`,borderRadius:20,padding:32,marginBottom:20,textAlign:'center',boxShadow:`0 0 40px ${cfg.color}20`}}>
        <div style={{display:'inline-block',padding:'6px 16px',borderRadius:8,border:`1px solid ${cfg.color}`,color:cfg.color,fontSize:14,fontWeight:700,letterSpacing:2,marginBottom:20}}>
          {cfg.label}
        </div>
        {player.state === 'GRACE' ? (
          <>
            <div style={{fontSize:72,color:'#c084fc',fontFamily:'monospace'}}>∞</div>
            <div style={{fontSize:16,color:'#a78bfa',marginTop:6}}>时间已超越</div>
          </>
        ) : player.state === 'DEAD' ? (
          <>
            <div style={{fontSize:64}}>💀</div>
            <div style={{fontFamily:'monospace',fontSize:48,color:'#ef4444'}}>00:00:00</div>
          </>
        ) : (
          <div style={{fontFamily:'monospace',fontSize:64,color:timeColor,textShadow:`0 0 30px ${timeColor}`}}>
            {formatTime(liveTime)}
          </div>
        )}
        {!player.time_bank_is_infinite && (
          <div style={{marginTop:16,height:6,background:'rgba(255,255,255,0.06)',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${timePct}%`,background:timeColor,borderRadius:3,transition:'width 1s linear'}} />
          </div>
        )}
      </div>

      {/* Team */}
      {team && (
        <div style={{background:team.color+'11',border:`1px solid ${team.color}44`,borderRadius:16,padding:20,marginBottom:20,display:'flex',alignItems:'center',gap:16}}>
          <span style={{fontSize:32}}>{team.emblem}</span>
          <div>
            <div style={{fontWeight:700,fontSize:18,color:team.color}}>{team.name}</div>
            <div style={{fontSize:13,color:'#4a6278'}}>你的队伍</div>
          </div>
          <div style={{marginLeft:'auto',textAlign:'right'}}>
            <div style={{fontFamily:'monospace',fontSize:24,color:team.color}}>{team.score}</div>
            <div style={{fontSize:13,color:'#4a6278'}}>队伍积分</div>
          </div>
        </div>
      )}

      {/* Score */}
      <div style={{background:'#0c1020',border:'1px solid #1e2a3a',borderRadius:16,padding:20,marginBottom:20,textAlign:'center'}}>
        <div style={{fontFamily:'monospace',fontSize:48,color:cfg.color}}>{player.score}</div>
        <div style={{fontSize:13,color:'#4a6278',letterSpacing:2,textTransform:'uppercase'}}>个人积分</div>
      </div>

      {/* Grace Button */}
      {player.state === 'ALIVE' && !graceConfirm && (
        <button onClick={() => setGraceConfirm(true)} style={{width:'100%',padding:'16px',borderRadius:12,background:'rgba(192,132,252,0.1)',border:'1px solid rgba(192,132,252,0.4)',color:'#c084fc',fontWeight:700,fontSize:16,cursor:'pointer',marginBottom:16}}>
          ✨ 选择 GRACE — 放弃时间
        </button>
      )}

      {graceConfirm && (
        <div style={{background:'rgba(192,132,252,0.1)',border:'1px solid rgba(192,132,252,0.4)',borderRadius:16,padding:24,marginBottom:16,textAlign:'center'}}>
          <div style={{fontWeight:700,fontSize:18,marginBottom:10,color:'#e9d5ff'}}>你确定吗？</div>
          <div style={{fontSize:14,color:'#a78bfa',marginBottom:20}}>你将永远放弃时间银行，无法参与普通积分，但会解锁特殊任务线。</div>
          <div style={{display:'flex',gap:10,justifyContent:'center'}}>
            <button onClick={chooseGrace} style={{padding:'10px 20px',borderRadius:10,background:'rgba(192,132,252,0.2)',border:'1px solid #c084fc',color:'#c084fc',fontWeight:700,fontSize:15,cursor:'pointer'}}>
              ✨ 确认选择
            </button>
            <button onClick={() => setGraceConfirm(false)} style={{padding:'10px 20px',borderRadius:10,background:'transparent',border:'1px solid #1e2a3a',color:'#4a6278',fontSize:15,cursor:'pointer'}}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* NPC Role */}
      {player.state === 'NPC' && player.npc_role && (
        <div style={{background:'#1a1a2e',border:'1px solid #6366f144',borderRadius:16,padding:20,textAlign:'center'}}>
          <div style={{fontSize:13,color:'#6366f1',letterSpacing:2,marginBottom:6}}>NPC 角色</div>
          <div style={{fontSize:28,fontWeight:700,color:'#a5b4fc'}}>{player.npc_role}</div>
        </div>
      )}
    </div>
  )
}
