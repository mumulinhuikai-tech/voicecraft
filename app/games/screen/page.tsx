'use client'

import { useEffect, useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../../lib/supabase'

// ─── Word Cloud ───────────────────────────────────────────────────────────────

const WORD_COLORS = [
  '#ff4d6d', '#ff8fa3', '#ff6b9d', '#c77dff', '#7b2fff',
  '#00e5ff', '#48cae4', '#ffd60a', '#fb8500', '#ff9f1c',
  '#4ade80', '#a3e635',
]

function WordCloud({ responses }: { responses: any[] }) {
  const freq: Record<string, number> = {}
  responses.forEach(r => {
    const w = r.value.trim()
    if (w) freq[w] = (freq[w] || 0) + 1
  })
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
  const maxCount = sorted[0]?.[1] || 1

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '20px 40px', minHeight: 300 }}>
      {sorted.map(([word, count], i) => {
        const size = 22 + Math.round((count / maxCount) * 58)
        const color = WORD_COLORS[i % WORD_COLORS.length]
        return (
          <span key={word} style={{
            fontSize: size,
            fontWeight: count > 1 ? 900 : 700,
            color,
            textShadow: `0 0 ${count > 1 ? 20 : 10}px ${color}66`,
            lineHeight: 1.2,
            animation: 'fadeIn 0.5s ease',
            transition: 'all 0.4s ease',
          }}>
            {word}
            {count > 1 && <sup style={{ fontSize: size * 0.4, color: `${color}99`, marginLeft: 2 }}>{count}</sup>}
          </span>
        )
      })}
      {sorted.length === 0 && (
        <div style={{ color: '#1e2a3a', fontSize: 28, fontWeight: 700 }}>等待回应中...</div>
      )}
    </div>
  )
}

// ─── Poll Results ─────────────────────────────────────────────────────────────

function PollResults({ session, responses }: { session: any; responses: any[] }) {
  const options: string[] = session.options || []
  const counts = options.map(opt => responses.filter(r => r.value === opt).length)
  const total = responses.length
  const maxCount = Math.max(...counts, 1)

  return (
    <div style={{ padding: '0 40px', width: '100%', maxWidth: 900, margin: '0 auto' }}>
      {counts.map((count, i) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const colors = ['#ff4d6d', '#c77dff', '#00e5ff', '#ffd60a']
        const color = colors[i % colors.length]
        return (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#c8d8e8' }}>{options[i]}</span>
              <span style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'monospace' }}>{pct}%</span>
            </div>
            <div style={{ height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(count / maxCount) * 100}%`,
                background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                borderRadius: 10,
                transition: 'width 0.6s ease',
                boxShadow: `0 0 12px ${color}66`,
              }} />
            </div>
            <div style={{ fontSize: 14, color: '#4a6278', marginTop: 4 }}>{count} 票</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Scale Results ────────────────────────────────────────────────────────────

function ScaleResults({ responses }: { responses: any[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    label: String(i + 1),
    count: responses.filter(r => r.value === String(i + 1)).length,
  }))
  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  const total = responses.length
  const avg = total > 0
    ? (responses.reduce((s, r) => s + Number(r.value), 0) / total).toFixed(1)
    : '—'

  return (
    <div style={{ padding: '0 40px', width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, height: 200, marginBottom: 16 }}>
        {buckets.map((b, i) => {
          const h = maxCount > 0 ? Math.max(4, (b.count / maxCount) * 180) : 4
          const t = i / 9
          const r = Math.round(255 * (1 - t) + 74 * t)
          const g = Math.round(77 * (1 - t) + 222 * t)
          const bl = Math.round(109 * (1 - t) + 128 * t)
          const color = `rgb(${r},${g},${bl})`
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              {b.count > 0 && <div style={{ fontSize: 14, fontWeight: 700, color }}>{b.count}</div>}
              <div style={{ width: 52, height: h, background: color, borderRadius: '6px 6px 0 0', boxShadow: `0 0 12px ${color}66`, transition: 'height 0.5s ease' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#c8d8e8' }}>{b.label}</div>
            </div>
          )
        })}
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 60, fontWeight: 900, color: '#ff4d6d', fontFamily: 'monospace' }}>{avg}</span>
        <span style={{ fontSize: 20, color: '#4a6278', marginLeft: 8 }}>/ 10 平均分</span>
      </div>
    </div>
  )
}

// ─── Race Results ─────────────────────────────────────────────────────────────

function RaceResults({ session, responses }: { session: any; responses: any[] }) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [raceActive, setRaceActive] = useState(false)

  useEffect(() => {
    if (session.status !== 'active' || !session.started_at) return
    const duration = session.duration_seconds || 20
    const end = new Date(session.started_at).getTime() + duration * 1000
    const update = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setTimeLeft(left)
      setRaceActive(left > 0)
    }
    update()
    const iv = setInterval(update, 200)
    return () => clearInterval(iv)
  }, [session])

  const sorted = [...responses].sort((a, b) => Number(b.value) - Number(a.value))
  const maxTaps = sorted[0] ? Number(sorted[0].value) : 1

  return (
    <div style={{ padding: '0 40px', width: '100%', maxWidth: 900, margin: '0 auto' }}>
      {raceActive && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 80, fontWeight: 900, fontFamily: 'monospace', color: timeLeft <= 5 ? '#ef4444' : '#ff4d6d', textShadow: `0 0 30px ${timeLeft <= 5 ? '#ef4444' : '#ff4d6d'}`, animation: timeLeft <= 5 ? 'pulse 0.5s infinite' : 'none' }}>
            {timeLeft}
          </div>
          <div style={{ fontSize: 14, color: '#4a6278', letterSpacing: 2 }}>秒</div>
        </div>
      )}
      {!raceActive && sorted.length === 0 && (
        <div style={{ textAlign: 'center', color: '#4a6278', fontSize: 24, padding: 40 }}>等待玩家点击...</div>
      )}
      {sorted.slice(0, 8).map((r, i) => {
        const taps = Number(r.value)
        const pct = (taps / maxTaps) * 100
        const rankColors = ['#fde68a', '#c8d8e8', '#f97316', '#4ade80', '#c084fc', '#60a5fa', '#fb7185', '#a3e635']
        const color = rankColors[i] || '#4a6278'
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color, width: 32, textAlign: 'center' }}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
            </div>
            <div style={{ width: 100, fontSize: 14, fontWeight: 700, color: '#c8d8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.player_name}</div>
            <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 8, transition: 'width 0.3s ease', boxShadow: `0 0 8px ${color}88` }} />
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, color, minWidth: 50, textAlign: 'right' }}>{taps}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── EKG Animation ───────────────────────────────────────────────────────────

function EKGLine() {
  return (
    <svg viewBox="0 0 600 60" style={{ width: '100%', maxWidth: 600, opacity: 0.3 }}>
      <polyline
        points="0,30 80,30 100,30 115,5 130,55 145,30 175,30 195,30 210,12 225,48 240,30 270,30 285,30 300,8 315,52 330,30 360,30 380,30 395,14 410,46 425,30 455,30 470,30 485,10 500,50 515,30 545,30 575,30 600,30"
        fill="none"
        stroke="#ff4d6d"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: 800, strokeDashoffset: 800, animation: 'ekg 2s linear infinite' }}
      />
    </svg>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GamesScreenPage() {
  const [session, setSession] = useState<any>(null)
  const [responses, setResponses] = useState<any[]>([])
  const [waiting, setWaiting] = useState(true)
  const [joinUrl, setJoinUrl] = useState('')

  useEffect(() => {
    setJoinUrl(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/join`)
  }, [])

  const fetchData = async () => {
    const res = await fetch('/api/games')
    const data = await res.json()
    setSession(data.session)
    setResponses(data.responses || [])
    setWaiting(!data.session)
  }

  useEffect(() => {
    fetchData()
    const ch = supabase
      .channel('games-screen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_responses' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#040609', color: '#c8d8e8', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
      <style>{`
        @keyframes ekg {
          0% { stroke-dashoffset: 800; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.3); }
          28% { transform: scale(1); }
          42% { transform: scale(1.15); }
          70% { transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      {/* Header */}
      <div style={{ width: '100%', padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', borderBottom: '1px solid #0d1525' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 32, animation: 'heartbeat 1.5s ease-in-out infinite' }}>💓</span>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ff4d6d', letterSpacing: 3 }}>新的心跳</div>
            <div style={{ fontSize: 11, color: '#4a6278', letterSpacing: 2 }}>互动游戏</div>
          </div>
        </div>
        {session && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#ff4d6d', fontFamily: 'monospace', lineHeight: 1 }}>{responses.length}</div>
            <div style={{ fontSize: 12, color: '#4a6278', letterSpacing: 1 }}>位参与者</div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>

        {/* Waiting state */}
        {!session && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{ fontSize: 70, marginBottom: 16, animation: 'heartbeat 2s ease-in-out infinite' }}>💓</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#ff4d6d', letterSpacing: 2, marginBottom: 8 }}>新的心跳</div>
            <div style={{ fontSize: 16, color: '#4a6278', marginBottom: 32 }}>拿出手机扫码，加入互动游戏</div>
            {joinUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ background: '#fff', borderRadius: 20, padding: 16 }}>
                  <QRCodeSVG value={joinUrl} size={200} level="M" />
                </div>
                <div style={{ fontSize: 14, color: '#4a6278', fontFamily: 'monospace' }}>{joinUrl}</div>
              </div>
            )}
            <div style={{ marginTop: 32 }}>
              <EKGLine />
            </div>
          </div>
        )}

        {/* Active game */}
        {session && (
          <>
            {/* QR Code corner */}
            {joinUrl && (
              <div style={{ position: 'fixed', bottom: 70, right: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'rgba(4,6,9,0.85)', border: '1px solid #1e2a3a', borderRadius: 14, padding: 12 }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: 6 }}>
                  <QRCodeSVG value={joinUrl} size={80} level="M" />
                </div>
                <div style={{ fontSize: 9, color: '#4a6278', letterSpacing: 1 }}>扫码参与</div>
              </div>
            )}
            {/* Question */}
            <div style={{ textAlign: 'center', padding: '0 40px', marginBottom: 32, maxWidth: 1000, width: '100%' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ff4d6d', letterSpacing: 3, marginBottom: 10, textTransform: 'uppercase' }}>
                {session.type === 'poll' ? '🗳️ 全场投票' :
                  session.type === 'wordcloud' ? '☁️ 心声词云' :
                    session.type === 'scale' ? '📊 心跳刻度' : '💓 心跳竞速'}
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#e2e8f0', lineHeight: 1.3, whiteSpace: 'pre-line' }}>
                {session.question}
              </div>
            </div>

            {/* Results by type */}
            {session.type === 'poll' && <PollResults session={session} responses={responses} />}
            {session.type === 'wordcloud' && <WordCloud responses={responses} />}
            {session.type === 'scale' && <ScaleResults responses={responses} />}
            {session.type === 'race' && <RaceResults session={session} responses={responses} />}
          </>
        )}
      </div>

      {/* Footer EKG */}
      <div style={{ width: '100%', padding: '12px 40px', boxSizing: 'border-box', borderTop: '1px solid #0d1525' }}>
        <EKGLine />
      </div>
    </div>
  )
}
