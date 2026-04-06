'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface AudioTrimmerProps {
  file: File
  onTrimmed: (trimmedFile: File) => void
  onCancel: () => void
}

export default function AudioTrimmer({ file, onTrimmed, onCancel }: AudioTrimmerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Decoded audio buffer — populated after loading, never nulled out
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  // Ref pointing to the <audio> element rendered in JSX
  const audioElRef = useRef<HTMLAudioElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const animFrameRef = useRef<number>(0)
  const [audioSrc, setAudioSrc] = useState<string>('')

  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [loadStatus, setLoadStatus] = useState<'reading' | 'decoding' | 'ready' | 'error'>('reading')
  const [isTrimming, setIsTrimming] = useState(false)
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null)

  const isLoading = loadStatus === 'reading' || loadStatus === 'decoding'

  // ── Load: create object URL for <audio> preview + decode for waveform ──
  useEffect(() => {
    let cancelled = false
    setLoadStatus('reading')
    audioBufferRef.current = null

    // Revoke previous object URL
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }

    // Create object URL immediately — lets <audio> play without full decode
    const objUrl = URL.createObjectURL(file)
    objectUrlRef.current = objUrl
    setAudioSrc(objUrl)

    const load = async () => {
      const arrayBuffer = await file.arrayBuffer()
      if (cancelled) return
      setLoadStatus('decoding')
      const decodeCtx = new AudioContext()
      try {
        const decoded = await decodeCtx.decodeAudioData(arrayBuffer)
        if (cancelled) { decodeCtx.close(); return }
        audioBufferRef.current = decoded
        setDuration(decoded.duration)
        setStartTime(0)
        setEndTime(decoded.duration)
        setLoadStatus('ready')
        drawWaveform(decoded)
      } finally {
        decodeCtx.close()
      }
    }

    load().catch((err) => {
      console.error('[AudioTrimmer] load failed:', err)
      if (!cancelled) setLoadStatus('error')
    })

    return () => {
      cancelled = true
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
      setAudioSrc('')
    }
  }, [file])

  // ── Waveform drawing ──
  function drawWaveform(buffer: AudioBuffer) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    const data = buffer.getChannelData(0)
    const step = Math.ceil(data.length / width)
    const mid = height / 2

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#6d28d9'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < width; i++) {
      let min = 0, max = 0
      for (let j = 0; j < step; j++) {
        const val = data[i * step + j] || 0
        if (val < min) min = val
        if (val > max) max = val
      }
      ctx.moveTo(i, mid + min * mid * 0.9)
      ctx.lineTo(i, mid + max * mid * 0.9)
    }
    ctx.stroke()
  }

  // ── Overlay (selection + handles + playhead) ──
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current
    const buffer = audioBufferRef.current
    if (!canvas || !buffer) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    const dur = buffer.duration

    drawWaveform(buffer)

    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, (startTime / dur) * width, height)
    ctx.fillRect((endTime / dur) * width, 0, width, height)

    ctx.fillStyle = 'rgba(139,92,246,0.12)'
    ctx.fillRect((startTime / dur) * width, 0, ((endTime - startTime) / dur) * width, height)

    const drawHandle = (t: number, side: 'left' | 'right') => {
      const x = (t / dur) * width
      ctx.fillStyle = '#7c3aed'
      ctx.fillRect(x - 1.5, 0, 3, height)
      ctx.fillStyle = '#a78bfa'
      ctx.beginPath()
      if (side === 'left') {
        ctx.moveTo(x - 1.5, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x - 1.5, 14)
      } else {
        ctx.moveTo(x + 1.5, 0); ctx.lineTo(x - 10, 0); ctx.lineTo(x + 1.5, 14)
      }
      ctx.closePath(); ctx.fill()
    }
    drawHandle(startTime, 'left')
    drawHandle(endTime, 'right')

    if (playhead > 0 && playhead < dur) {
      const px = (playhead / dur) * width
      ctx.strokeStyle = '#f0abfc'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke()
    }
  }, [startTime, endTime, playhead])

  useEffect(() => {
    if (loadStatus === 'ready') drawOverlay()
  }, [loadStatus, startTime, endTime, playhead, drawOverlay])

  // ── Playhead animation (driven by <audio>.currentTime) ──
  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(animFrameRef.current); return }
    const tick = () => {
      const audio = audioElRef.current
      if (!audio) return
      const t = audio.currentTime
      setPlayhead(t)
      if (t >= endTime) { stopPlayback(); return }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying, endTime])

  function stopPlayback() {
    const audio = audioElRef.current
    if (audio) { audio.pause(); audio.currentTime = startTime }
    setIsPlaying(false)
    cancelAnimationFrame(animFrameRef.current)
  }

  // ── Play — uses the <audio> element (no AudioContext needed) ──
  function togglePlay() {
    const audio = audioElRef.current
    if (!audio) return
    if (isPlaying) { stopPlayback(); return }
    audio.currentTime = startTime
    audio.play().then(() => setIsPlaying(true)).catch(console.error)
  }

  // ── Canvas interaction ──
  function getTimeFromX(clientX: number): number {
    const canvas = canvasRef.current
    const buffer = audioBufferRef.current
    if (!canvas || !buffer) return 0
    const rect = canvas.getBoundingClientRect()
    return (Math.max(0, Math.min(clientX - rect.left, rect.width)) / rect.width) * buffer.duration
  }

  function resolveHandleDrag(clickPx: number, dur: number, canvasW: number): 'start' | 'end' {
    const startPx = (startTime / dur) * canvasW
    const endPx = (endTime / dur) * canvasW
    return Math.abs(clickPx - startPx) <= Math.abs(clickPx - endPx) ? 'start' : 'end'
  }

  function onMouseDown(e: React.MouseEvent) {
    const canvas = canvasRef.current; const buffer = audioBufferRef.current
    if (!canvas || !buffer) return
    const rect = canvas.getBoundingClientRect()
    const clickPx = e.clientX - rect.left
    const handle = resolveHandleDrag(clickPx, buffer.duration, rect.width)
    setDragging(handle)
    const t = getTimeFromX(e.clientX)
    if (handle === 'start') setStartTime(Math.max(0, Math.min(t, endTime - 0.5)))
    else setEndTime(Math.max(startTime + 0.5, Math.min(t, buffer.duration)))
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    const dur = audioBufferRef.current?.duration || 1
    const t = getTimeFromX(e.clientX)
    if (dragging === 'start') setStartTime(Math.max(0, Math.min(t, endTime - 0.5)))
    else setEndTime(Math.max(startTime + 0.5, Math.min(t, dur)))
  }

  function onTouchStart(e: React.TouchEvent) {
    const canvas = canvasRef.current; const buffer = audioBufferRef.current
    if (!canvas || !buffer) return
    const rect = canvas.getBoundingClientRect()
    const touchPx = e.touches[0].clientX - rect.left
    const handle = resolveHandleDrag(touchPx, buffer.duration, rect.width)
    setDragging(handle)
    const t = getTimeFromX(e.touches[0].clientX)
    if (handle === 'start') setStartTime(Math.max(0, Math.min(t, endTime - 0.5)))
    else setEndTime(Math.max(startTime + 0.5, Math.min(t, buffer.duration)))
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return
    const dur = audioBufferRef.current?.duration || 1
    const t = getTimeFromX(e.touches[0].clientX)
    if (dragging === 'start') setStartTime(Math.max(0, Math.min(t, endTime - 0.5)))
    else setEndTime(Math.max(startTime + 0.5, Math.min(t, dur)))
  }

  // ── Trim & export ──
  async function handleTrim() {
    const buffer = audioBufferRef.current
    if (!buffer) return
    setIsTrimming(true)
    stopPlayback()

    const trimDur = endTime - startTime
    const offline = new OfflineAudioContext(1, Math.ceil(trimDur * 22050), 22050)
    const src = offline.createBufferSource()
    src.buffer = buffer
    src.connect(offline.destination)
    src.start(0, startTime, trimDur)

    const rendered = await offline.startRendering()
    const wav = encodeWav(rendered)
    const blob = new Blob([wav], { type: 'audio/wav' })
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(1)
    const name = file.name.replace(/\.[^.]+$/, '') + `_trim_${fmt(startTime)}-${fmt(endTime)}_${sizeMB}MB.wav`
    setIsTrimming(false)
    onTrimmed(new File([blob], name, { type: 'audio/wav' }))
  }

  function encodeWav(buffer: AudioBuffer): ArrayBuffer {
    const ch = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length
    const ab = new ArrayBuffer(44 + len * ch * 2)
    const v = new DataView(ab)
    const s = (off: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)) }
    s(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); s(8, 'WAVE'); s(12, 'fmt ')
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true)
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true)
    v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); s(36, 'data')
    v.setUint32(40, len * ch * 2, true)
    let off = 44
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
      const samp = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]))
      v.setInt16(off, samp < 0 ? samp * 0x8000 : samp * 0x7fff, true); off += 2
    }
    return ab
  }

  function fmt(s: number) {
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  const trimDuration = endTime - startTime
  const estimatedMB = ((trimDuration * 22050 * 2 + 44) / (1024 * 1024)).toFixed(1)

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
      {/* Hidden audio element — mounted in DOM so browser allows playback */}
      <audio
        ref={audioElRef}
        src={audioSrc}
        preload="auto"
        onEnded={() => { setIsPlaying(false); setPlayhead(0) }}
        style={{ display: 'none' }}
      />

      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-200 truncate">{file.name}</p>
          {loadStatus === 'ready' && (
            <p className="text-xs text-neutral-500">
              总长：{fmt(duration)} · 已选：{fmt(trimDuration)}（{fmt(startTime)} – {fmt(endTime)}）
            </p>
          )}
        </div>
        <button onClick={onCancel} className="ml-2 shrink-0 text-neutral-500 hover:text-neutral-300 text-sm">取消</button>
      </div>

      {isLoading ? (
        <div className="h-20 rounded-lg bg-neutral-800 flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span className="text-xs text-neutral-400">
            {loadStatus === 'reading' ? '读取文件中…' : '解码音频中，大文件需要一点时间…'}
          </span>
        </div>
      ) : loadStatus === 'error' ? (
        <div className="h-20 rounded-lg bg-neutral-800 flex items-center justify-center">
          <span className="text-xs text-red-400">音频加载失败，请检查文件格式</span>
        </div>
      ) : (
        <>
          <div className="relative select-none">
            <canvas
              ref={canvasRef} width={600} height={80}
              className="w-full h-20 rounded-lg cursor-col-resize touch-none"
              onMouseDown={onMouseDown} onMouseMove={onMouseMove}
              onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => setDragging(null)}
            />
            <p className="mt-1 text-[10px] text-neutral-600 text-center">拖动两侧紫色把手选取区间</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[['开始（秒）', startTime, (v: number) => setStartTime(Math.max(0, Math.min(v, endTime - 0.5))), 0, endTime - 0.5] as const,
              ['结束（秒）', endTime, (v: number) => setEndTime(Math.max(startTime + 0.5, Math.min(v, duration))), startTime + 0.5, duration] as const
            ].map(([label, val, setter, min, max]) => (
              <div key={label} className="space-y-1">
                <label className="text-[11px] text-neutral-500">{label}</label>
                <input type="number" min={min} max={max} step={0.1}
                  value={(val as number).toFixed(1)}
                  onChange={(e) => (setter as (v: number) => void)(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={togglePlay}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-2 text-sm text-neutral-200 transition-colors"
            >
              {isPlaying ? (
                <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>暂停</>
              ) : (
                <><svg className="w-3.5 h-3.5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>试听选区</>
              )}
            </button>
            <button type="button" onClick={handleTrim} disabled={isTrimming}
              className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white transition-colors"
            >
              {isTrimming ? '裁剪中…' : `确认裁剪（${fmt(trimDuration)} · 约 ${estimatedMB} MB）`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
