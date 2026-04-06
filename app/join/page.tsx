'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

// ─── Game Widget ──────────────────────────────────────────────────────────────

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

  useEffect(() => {
    tapSubmittedRef.current = false
    setSubmitted(false)
    setMyResponse('')
    setPollChoice(null)
    setWordInput('')
    setScaleValue(5)
    setTapCount(0)
    setRaceStarted(false)
    fetch(`/api/games?session_id=${session.id}&player_id=${encodeURIComponent(playerId)}`)
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
        setTapCount(prev => { submitResponse(String(prev)); return prev })
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

  const typeColors: Record<string, string> = { poll: '#c77dff', wordcloud: '#00e5ff', scale: '#ffd60a', race: '#ff4d6d' }
  const accent = typeColors[session.type] || '#ff4d6d'

  return (
    <div style={{ background: `${accent}0d`, border: `2px solid ${accent}55`, borderRadius: 20, padding: 20 }}>
      <style>{`.tap-btn:active { transform: scale(0.9) !important; }`}</style>

      <div style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 16, lineHeight: 1.4, whiteSpace: 'pre-line' }}>
        {session.question}
      </div>

      {submitted ? (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <div style={{ fontWeight: 700, color: accent, marginTop: 6, fontSize: 18 }}>已提交！</div>
          {session.type !== 'race' && <div style={{ fontSize: 13, color: '#4a6278', marginTop: 4 }}>你的回答：{myResponse}</div>}
          {session.type === 'race' && <div style={{ fontSize: 13, color: '#4a6278', marginTop: 4 }}>你点击了 {myResponse} 下！</div>}
        </div>
      ) : (
        <>
          {session.type === 'poll' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(session.options || []).map((opt: string, i: number) => (
                <button key={i} onClick={() => { setPollChoice(opt); submitResponse(opt) }}
                  disabled={submitting}
                  style={{ padding: '14px 16px', borderRadius: 12, background: pollChoice === opt ? `${accent}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${pollChoice === opt ? accent : '#1e2a3a'}`, color: pollChoice === opt ? accent : '#c8d8e8', fontWeight: 700, fontSize: 15, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {session.type === 'wordcloud' && (
            <div>
              <input value={wordInput} onChange={e => setWordInput(e.target.value.slice(0, 20))}
                placeholder="输入一个词..." maxLength={20}
                style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid #1e2a3a', color: '#e2e8f0', fontSize: 22, fontWeight: 700, outline: 'none', marginBottom: 12, textAlign: 'center' }}
                onKeyDown={e => { if (e.key === 'Enter' && wordInput.trim()) submitResponse(wordInput.trim()) }} />
              <button onClick={() => wordInput.trim() && submitResponse(wordInput.trim())}
                disabled={submitting || !wordInput.trim()}
                style={{ width: '100%', padding: '14px', borderRadius: 12, background: `${accent}22`, border: `1px solid ${accent}`, color: accent, fontWeight: 900, fontSize: 16, cursor: 'pointer', opacity: !wordInput.trim() ? 0.4 : 1 }}>
                提交
              </button>
            </div>
          )}

          {session.type === 'scale' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 64, fontWeight: 900, color: accent, fontFamily: 'monospace', lineHeight: 1 }}>{scaleValue}</span>
              </div>
              <input type="range" min={1} max={10} value={scaleValue}
                onChange={e => setScaleValue(Number(e.target.value))}
                style={{ width: '100%', accentColor: accent, cursor: 'pointer', marginBottom: 6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4a6278', marginBottom: 14 }}>
                <span>1 完全不是</span><span>10 完全是</span>
              </div>
              <button onClick={() => submitResponse(String(scaleValue))} disabled={submitting}
                style={{ width: '100%', padding: '14px', borderRadius: 12, background: `${accent}22`, border: `1px solid ${accent}`, color: accent, fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>
                提交 {scaleValue} 分
              </button>
            </div>
          )}

          {session.type === 'race' && raceStarted && raceTimeLeft > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, color: raceTimeLeft <= 5 ? '#ef4444' : '#4a6278', fontFamily: 'monospace', fontWeight: 700, marginBottom: 6 }}>
                剩余 {raceTimeLeft} 秒
              </div>
              <div style={{ fontSize: 72, fontWeight: 900, color: accent, marginBottom: 16, fontFamily: 'monospace', lineHeight: 1 }}>{tapCount}</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="tap-btn"
                  onPointerDown={e => { e.preventDefault(); setTapCount(t => t + 1) }}
                  style={{ width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${accent}33, ${accent}11)`, border: `3px solid ${accent}`, color: accent, fontSize: 44, cursor: 'pointer', boxShadow: `0 0 30px ${accent}44`, userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.08s' }}>
                  💓
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#4a6278', marginTop: 10 }}>疯狂点击！</div>
            </div>
          )}
          {session.type === 'race' && !raceStarted && (
            <div style={{ textAlign: 'center', color: '#4a6278', padding: 16 }}>即将开始，做好准备...</div>
          )}
          {session.type === 'race' && raceStarted && raceTimeLeft === 0 && !submitted && (
            <div style={{ textAlign: 'center', color: '#4a6278', padding: 16 }}>提交中...</div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Join Page ────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [myName, setMyName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [activeGame, setActiveGame] = useState<any>(null)
  const [waiting, setWaiting] = useState(false)

  // Restore saved name on load
  useEffect(() => {
    const saved = localStorage.getItem('hb_player_name')
    const savedId = localStorage.getItem('hb_player_id')
    if (saved && savedId) {
      setMyName(saved)
      setPlayerId(savedId)
      setJoined(true)
    }
  }, [])

  // Watch for active game
  useEffect(() => {
    const fetchGame = async () => {
      const res = await fetch('/api/games')
      const data = await res.json()
      setActiveGame(data.session || null)
      setWaiting(!data.session)
    }
    fetchGame()
    const ch = supabase
      .channel('join-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, fetchGame)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const handleJoin = () => {
    if (!name.trim()) return
    const id = crypto.randomUUID()
    localStorage.setItem('hb_player_name', name.trim())
    localStorage.setItem('hb_player_id', id)
    setMyName(name.trim())
    setPlayerId(id)
    setJoined(true)
  }

  const handleReset = () => {
    localStorage.removeItem('hb_player_name')
    localStorage.removeItem('hb_player_id')
    setJoined(false)
    setMyName('')
    setPlayerId('')
    setName('')
  }

  // Name entry screen
  if (!joined) return (
    <div style={{ minHeight: '100vh', background: '#040609', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'sans-serif' }}>
      <style>{`@keyframes heartbeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.3)} 28%{transform:scale(1)} 42%{transform:scale(1.15)} 70%{transform:scale(1)} }`}</style>
      <div style={{ fontSize: 56, marginBottom: 8, animation: 'heartbeat 1.8s ease-in-out infinite' }}>💓</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#ff4d6d', letterSpacing: 2, marginBottom: 4 }}>新的心跳</div>
      <div style={{ fontSize: 13, color: '#4a6278', letterSpacing: 1, marginBottom: 36 }}>互动游戏 · 输入你的名字加入</div>

      <input
        value={name}
        onChange={e => setName(e.target.value.slice(0, 16))}
        placeholder="你叫什么名字？"
        maxLength={16}
        onKeyDown={e => { if (e.key === 'Enter') handleJoin() }}
        style={{ width: '100%', maxWidth: 320, boxSizing: 'border-box', padding: '16px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '2px solid #ff4d6d44', color: '#e2e8f0', fontSize: 22, fontWeight: 700, outline: 'none', textAlign: 'center', marginBottom: 16 }}
        autoFocus
      />
      <button onClick={handleJoin} disabled={!name.trim()}
        style={{ width: '100%', maxWidth: 320, padding: '16px', borderRadius: 16, background: name.trim() ? 'rgba(255,77,109,0.2)' : 'rgba(255,255,255,0.03)', border: `2px solid ${name.trim() ? '#ff4d6d' : '#1e2a3a'}`, color: name.trim() ? '#ff4d6d' : '#4a6278', fontWeight: 900, fontSize: 18, cursor: name.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}>
        加入 →
      </button>
    </div>
  )

  // Joined screen
  return (
    <div style={{ minHeight: '100vh', background: '#040609', color: '#c8d8e8', fontFamily: 'sans-serif', padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes heartbeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.3)} 28%{transform:scale(1)} 42%{transform:scale(1.15)} 70%{transform:scale(1)} } @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24, animation: 'heartbeat 1.8s ease-in-out infinite' }}>💓</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ff4d6d' }}>{myName}</div>
            <div style={{ fontSize: 11, color: '#4a6278' }}>已加入新的心跳</div>
          </div>
        </div>
        <button onClick={handleReset}
          style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: '1px solid #1e2a3a', color: '#4a6278', fontSize: 11, cursor: 'pointer' }}>
          换人
        </button>
      </div>

      {/* Active Game */}
      {activeGame && (
        <GameWidget session={activeGame} playerId={playerId} playerName={myName} />
      )}

      {/* Waiting */}
      {!activeGame && (
        <div style={{ textAlign: 'center', paddingTop: 60, animation: 'float 3s ease-in-out infinite' }}>
          <div style={{ fontSize: 60, marginBottom: 16, animation: 'heartbeat 2s ease-in-out infinite' }}>💓</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ff4d6d', marginBottom: 8 }}>嗨，{myName}！</div>
          <div style={{ fontSize: 15, color: '#4a6278', lineHeight: 1.6 }}>
            等待游戏开始...<br />
            <span style={{ fontSize: 13 }}>老师开始互动时这里会自动弹出</span>
          </div>
        </div>
      )}
    </div>
  )
}
