'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type GameType = 'poll' | 'wordcloud' | 'scale' | 'race'

const TYPE_LABELS: Record<GameType, string> = {
  poll: '🗳️ 投票',
  wordcloud: '☁️ 词云',
  scale: '📊 刻度',
  race: '💓 心跳竞速',
}

const PRESETS: Record<GameType, { title: string; question: string; options?: string[] }[]> = {
  poll: [
    {
      title: '你现在最真实的状态是？',
      question: '你现在最真实的状态是？',
      options: ['疲惫但在撑着', '平静有盼望', '迷茫不知所措', '还在刷手机'],
    },
    {
      title: '让你最焦虑的事是？',
      question: '让你最焦虑的事是？',
      options: ['手机没电', '错过朋友消息', '未来方向未知', '不被人喜欢'],
    },
    {
      title: '你的心跳节奏是？',
      question: '你觉得自己现在的"心跳"是？',
      options: ['超快，停不下来', '正常，还好', '慢，有点麻木', '根本找不到'],
    },
    {
      title: '你通常怎么排解压力？',
      question: '你通常怎么排解压力？',
      options: ['刷手机短视频', '找朋友倾诉', '睡觉发呆', '根本不处理'],
    },
  ],
  wordcloud: [
    { title: '用一个词描述你现在的心', question: '用一个词描述你现在的心' },
    { title: '你想要的"新的心跳"是？', question: '你想要的"新的心跳"是什么？' },
    { title: '今天让你有感觉的一个词', question: '今天什么词让你有感觉？' },
  ],
  scale: [
    {
      title: '我的人生方向有多清晰？',
      question: '我对自己的人生方向有多清晰？\n（1 = 完全不清楚，10 = 非常清楚）',
    },
    {
      title: '今天之前，你的心有多平安？',
      question: '今天之前，你内心有多平安？\n（1 = 很焦虑，10 = 非常平安）',
    },
    {
      title: '你对自己有多真实？',
      question: '你平时对别人有多真实？\n（1 = 完全在表演，10 = 完全真实）',
    },
  ],
  race: [
    { title: '心跳竞速！疯狂点击！', question: '代表你的热情！限时疯狂点击！' },
    { title: '新的心跳！点击点燃激情！', question: '点击点燃你的新的心跳！' },
  ],
}

export default function GamesPage() {
  const [authed, setAuthed] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)

  const [gameType, setGameType] = useState<GameType>('poll')
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [duration, setDuration] = useState(20)
  const [creating, setCreating] = useState(false)

  const [sessions, setSessions] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!authed) return
    fetchSessions()
    const ch = supabase
      .channel('games-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, fetchSessions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_responses' }, fetchSessions)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [authed])

  const fetchSessions = async () => {
    const res = await fetch('/api/games?all=1')
    const data = await res.json()
    const allSessions = data.sessions || []
    setSessions(allSessions)
    setActiveSession(allSessions.find((s: any) => s.status === 'active') || null)

    // Fetch response counts
    const counts: Record<string, number> = {}
    await Promise.all(
      allSessions.slice(0, 5).map(async (s: any) => {
        const r = await fetch(`/api/games?session_id=${s.id}&player_id=__count__`)
        // Just use the active game's live count via realtime
        counts[s.id] = 0
      })
    )
    setResponseCounts(counts)
  }

  const applyPreset = (preset: { title: string; question: string; options?: string[] }) => {
    setTitle(preset.title)
    setQuestion(preset.question)
    if (preset.options) setOptions([...preset.options, '', ''].slice(0, 4))
    else setOptions(['', '', '', ''])
  }

  const createGame = async () => {
    if (!title.trim() || !question.trim()) return
    setCreating(true)
    const opts = gameType === 'poll' ? options.filter(o => o.trim()) : undefined
    await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', type: gameType, title: title.trim(), question: question.trim(), options: opts, duration_seconds: duration }),
    })
    setTitle('')
    setQuestion('')
    setOptions(['', '', '', ''])
    setCreating(false)
    fetchSessions()
  }

  const activateGame = async (id: string) => {
    await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate', id }),
    })
    fetchSessions()
  }

  const endGame = async (id: string) => {
    await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end', id }),
    })
    fetchSessions()
  }

  const deleteGame = async (id: string) => {
    if (!confirm('删除此游戏及所有回应？')) return
    await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    fetchSessions()
  }

  if (!authed) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#060810', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#ff4d6d', letterSpacing: 2 }}>💓 新的心跳</div>
      <div style={{ fontSize: 13, color: '#4a6278', letterSpacing: 2 }}>GAMES ADMIN</div>
      <input
        type="password"
        placeholder="请输入密码"
        value={pwInput}
        onChange={e => { setPwInput(e.target.value); setPwError(false) }}
        onKeyDown={e => { if (e.key === 'Enter') { if (pwInput === '0619') setAuthed(true); else setPwError(true) } }}
        style={{ padding: '10px 16px', borderRadius: 8, background: '#0c1020', border: `1px solid ${pwError ? '#ef4444' : '#1e2a3a'}`, color: '#c8d8e8', fontSize: 16, outline: 'none', width: 200, textAlign: 'center' }}
        autoFocus
      />
      {pwError && <div style={{ color: '#ef4444', fontSize: 13 }}>密码错误</div>}
      <button onClick={() => { if (pwInput === '0619') setAuthed(true); else setPwError(true) }}
        style={{ padding: '8px 24px', borderRadius: 8, background: 'rgba(255,77,109,0.15)', border: '1px solid #ff4d6d66', color: '#ff4d6d', fontWeight: 700, cursor: 'pointer' }}>
        进入
      </button>
    </div>
  )

  const statusColor: Record<string, string> = { waiting: '#f59e0b', active: '#4ade80', ended: '#4a6278' }
  const statusLabel: Record<string, string> = { waiting: '待命', active: '进行中', ended: '已结束' }

  return (
    <div style={{ minHeight: '100vh', background: '#060810', color: '#c8d8e8', fontFamily: 'sans-serif', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#ff4d6d', letterSpacing: 2 }}>💓 新的心跳 — 互动游戏</div>
          <div style={{ fontSize: 12, color: '#4a6278', marginTop: 4 }}>Game Master 控制台</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/games/screen" target="_blank"
            style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,77,109,0.1)', border: '1px solid #ff4d6d44', color: '#ff4d6d', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            📺 大屏幕
          </a>
          <a href="/admin"
            style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(0,229,255,0.1)', border: '1px solid #00e5ff44', color: '#00e5ff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            ⚔ Admin
          </a>
        </div>
      </div>

      {/* SQL Setup Notice */}
      <details style={{ marginBottom: 20 }}>
        <summary style={{ cursor: 'pointer', color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>⚙️ 首次使用？展开查看 Supabase SQL 设置</summary>
        <pre style={{ background: '#0c1020', border: '1px solid #1e2a3a', borderRadius: 8, padding: 16, marginTop: 8, fontSize: 11, color: '#a3b8cc', overflow: 'auto' }}>{`-- 在 Supabase SQL Editor 中运行：
CREATE TABLE game_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  question TEXT,
  options JSONB,
  status TEXT DEFAULT 'waiting',
  duration_seconds INTEGER DEFAULT 20,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE game_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id TEXT,
  player_name TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 开启 Realtime：
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE game_responses;`}</pre>
      </details>

      {/* Active Game Banner */}
      {activeSession && (
        <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid #4ade8033', borderRadius: 16, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: '#4ade80', letterSpacing: 2, fontWeight: 700 }}>🟢 正在进行</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{activeSession.title}</div>
            <div style={{ fontSize: 12, color: '#4a6278', marginTop: 2 }}>{TYPE_LABELS[activeSession.type as GameType]}</div>
          </div>
          <button onClick={() => endGame(activeSession.id)}
            style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444444', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            停止游戏
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Create Game */}
        <div style={{ background: '#0c1020', border: '1px solid #1e2a3a', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ff4d6d', letterSpacing: 2, marginBottom: 16 }}>创建新游戏</div>

          {/* Game Type */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(Object.keys(TYPE_LABELS) as GameType[]).map(t => (
              <button key={t} onClick={() => { setGameType(t); setTitle(''); setQuestion(''); setOptions(['', '', '', '']) }}
                style={{ padding: '6px 12px', borderRadius: 8, background: gameType === t ? 'rgba(255,77,109,0.2)' : 'transparent', border: `1px solid ${gameType === t ? '#ff4d6d' : '#1e2a3a'}`, color: gameType === t ? '#ff4d6d' : '#4a6278', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Presets */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#4a6278', letterSpacing: 1, marginBottom: 6 }}>快速预设</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRESETS[gameType].map((p, i) => (
                <button key={i} onClick={() => applyPreset(p)}
                  style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,77,109,0.08)', border: '1px solid #ff4d6d22', color: '#ff8fa3', fontSize: 11, cursor: 'pointer' }}>
                  {p.title}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="游戏标题（显示在大屏幕）"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, background: '#111827', border: '1px solid #1e2a3a', color: '#c8d8e8', fontSize: 14, outline: 'none', marginBottom: 10 }} />

          {/* Question */}
          <textarea value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="问题内容"
            rows={2}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, background: '#111827', border: '1px solid #1e2a3a', color: '#c8d8e8', fontSize: 14, outline: 'none', resize: 'vertical', marginBottom: 10 }} />

          {/* Poll options */}
          {gameType === 'poll' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#4a6278', marginBottom: 6 }}>选项（2-4个）</div>
              {options.map((opt, i) => (
                <input key={i} value={opt} onChange={e => setOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                  placeholder={`选项 ${i + 1}${i < 2 ? ' *必填' : ' (可选)'}`}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, background: '#111827', border: `1px solid ${i < 2 ? '#1e2a3a' : '#111'}`, color: '#c8d8e8', fontSize: 13, outline: 'none', marginBottom: 6 }} />
              ))}
            </div>
          )}

          {/* Race duration */}
          {gameType === 'race' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#4a6278', marginBottom: 6 }}>比赛时长: {duration} 秒</div>
              <input type="range" min={10} max={60} value={duration} onChange={e => setDuration(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ff4d6d' }} />
            </div>
          )}

          <button onClick={createGame} disabled={creating || !title.trim() || !question.trim()}
            style={{ width: '100%', padding: '12px', borderRadius: 10, background: 'rgba(255,77,109,0.2)', border: '1px solid #ff4d6d', color: '#ff4d6d', fontWeight: 900, fontSize: 15, cursor: 'pointer', opacity: creating ? 0.5 : 1 }}>
            {creating ? '创建中...' : '✨ 创建游戏'}
          </button>
        </div>

        {/* Sessions List */}
        <div style={{ background: '#0c1020', border: '1px solid #1e2a3a', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ff4d6d', letterSpacing: 2 }}>游戏列表</div>
            <button onClick={fetchSessions} style={{ padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px solid #1e2a3a', color: '#4a6278', fontSize: 11, cursor: 'pointer' }}>刷新</button>
          </div>

          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {sessions.length === 0 && <div style={{ color: '#4a6278', textAlign: 'center', padding: 40, fontSize: 13 }}>暂无游戏，创建第一个！</div>}
            {sessions.map(s => (
              <div key={s.id} style={{ background: '#111827', border: `1px solid ${s.status === 'active' ? '#4ade8033' : '#1e2a3a'}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: '#4a6278', marginTop: 2 }}>{TYPE_LABELS[s.type as GameType]}</div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: `${statusColor[s.status]}22`, color: statusColor[s.status], border: `1px solid ${statusColor[s.status]}44`, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 8 }}>
                    {statusLabel[s.status]}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#4a6278', marginBottom: 10, fontStyle: 'italic' }}>{s.question}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {s.status === 'waiting' && (
                    <button onClick={() => activateGame(s.id)}
                      style={{ flex: 1, padding: '6px', borderRadius: 8, background: 'rgba(74,222,128,0.1)', border: '1px solid #4ade8044', color: '#4ade80', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      ▶ 开始
                    </button>
                  )}
                  {s.status === 'active' && (
                    <button onClick={() => endGame(s.id)}
                      style={{ flex: 1, padding: '6px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444444', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      ⏹ 停止
                    </button>
                  )}
                  <button onClick={() => deleteGame(s.id)}
                    style={{ padding: '6px 10px', borderRadius: 8, background: 'transparent', border: '1px solid #1e2a3a', color: '#4a6278', fontSize: 12, cursor: 'pointer' }}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
