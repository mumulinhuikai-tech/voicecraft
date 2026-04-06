'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ScreenPage() {
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel('screen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchData = async () => {
    const [p, t] = await Promise.all([
      supabase.from('players').select('*').order('score', { ascending: false }),
      supabase.from('teams').select('*').order('score', { ascending: false }),
    ])
    setPlayers(p.data || [])
    setTeams(t.data || [])
  }

  const aliveCount = players.filter(p => p.state === 'ALIVE').length
  const totalCount = players.filter(p => p.state !== 'NPC').length

  const rankColor = (i: number) => {
    if (i === 0) return '#fde68a'
    if (i === 1) return '#c8d8e8'
    if (i === 2) return '#f97316'
    return '#4a6278'
  }

  const rankBg = (i: number) => {
    if (i === 0) return 'rgba(253,230,138,0.08)'
    if (i === 1) return 'rgba(200,216,232,0.05)'
    if (i === 2) return 'rgba(249,115,22,0.06)'
    return 'transparent'
  }

  return (
    <div style={{minHeight:'100vh',background:'#060810',color:'#c8d8e8',fontFamily:'sans-serif',padding:'32px 40px',boxSizing:'border-box'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:36}}>
        <div style={{fontSize:32,fontWeight:900,color:'#00e5ff',letterSpacing:4,textTransform:'uppercase'}}>⚔ Camp Game</div>
        <div style={{display:'flex',alignItems:'center',gap:12,background:'#0c1020',border:'1px solid #1e2a3a',borderRadius:16,padding:'12px 24px'}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 8px #4ade80',animation:'pulse 2s infinite'}} />
          <span style={{fontSize:28,fontWeight:900,color:'#4ade80'}}>{aliveCount}</span>
          <span style={{fontSize:14,color:'#4a6278'}}>/ {totalCount} 存活</span>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:32}}>

        {/* Team Rankings */}
        <div>
          <div style={{fontSize:13,fontWeight:700,color:'#00e5ff',letterSpacing:3,marginBottom:16,textTransform:'uppercase'}}>队伍排名</div>
          {teams.map((t, i) => (
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:16,background:rankBg(i),border:`1px solid ${i < 3 ? rankColor(i)+'33' : '#1e2a3a'}`,borderRadius:16,padding:'20px 24px',marginBottom:12,transition:'all 0.3s'}}>
              <div style={{fontSize:28,fontWeight:900,color:rankColor(i),width:36,textAlign:'center'}}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
              </div>
              <div style={{fontSize:28}}>{t.emblem}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:22,fontWeight:700,color:t.color}}>{t.name}</div>
                <div style={{fontSize:12,color:'#4a6278',marginTop:2}}>
                  {players.filter(p => p.team_id === t.id && p.state === 'ALIVE').length} 人存活
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'monospace',fontSize:36,fontWeight:900,color:rankColor(i)}}>{t.score}</div>
                <div style={{fontSize:11,color:'#4a6278',letterSpacing:2}}>积分</div>
              </div>
            </div>
          ))}
        </div>

        {/* Player Rankings */}
        <div>
          <div style={{fontSize:13,fontWeight:700,color:'#00e5ff',letterSpacing:3,marginBottom:16,textTransform:'uppercase'}}>个人排名</div>
          <div style={{maxHeight:'calc(100vh - 180px)',overflowY:'auto'}}>
            {players.map((p, i) => {
              const team = teams.find(t => t.id === p.team_id)
              const stateColor: Record<string, string> = {
                ALIVE: '#4ade80', DEAD: '#ef4444', NPC: '#a5b4fc', GRACE: '#c084fc', CROWNED: '#fde68a'
              }
              return (
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,background:rankBg(i),border:`1px solid ${i < 3 ? rankColor(i)+'33' : '#1e2a3a'}`,borderRadius:12,padding:'14px 20px',marginBottom:8,opacity:p.state==='DEAD'?0.5:1}}>
                  <div style={{fontSize:18,fontWeight:900,color:rankColor(i),width:28,textAlign:'center'}}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:18,fontWeight:700}}>{p.name}</div>
                    {team && <div style={{fontSize:11,color:team.color}}>{team.emblem} {team.name}</div>}
                  </div>
                  <div style={{padding:'2px 8px',borderRadius:4,border:`1px solid ${stateColor[p.state]||'#4a6278'}`,color:stateColor[p.state]||'#4a6278',fontSize:10,fontWeight:700}}>
                    {p.state}
                  </div>
                  <div style={{fontFamily:'monospace',fontSize:24,fontWeight:900,color:rankColor(i),minWidth:48,textAlign:'right'}}>{p.score}</div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
