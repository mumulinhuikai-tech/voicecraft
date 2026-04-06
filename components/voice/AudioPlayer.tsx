'use client'

import { useRef, useEffect, useState } from 'react'

interface AudioPlayerProps {
  audioUrl: string | null
  isLoading?: boolean
}

export default function AudioPlayer({ audioUrl, isLoading }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

  // Reset when URL changes
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [audioUrl])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const t = (parseFloat(e.target.value) / 100) * duration
    audio.currentTime = t
    setCurrentTime(t)
  }

  function formatTime(s: number): string {
    if (isNaN(s) || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-neutral-700 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-2 bg-neutral-700 rounded-full animate-pulse" />
            <div className="h-2 bg-neutral-700 rounded-full animate-pulse w-1/2" />
          </div>
        </div>
        <p className="text-center text-sm text-neutral-500 animate-pulse">
          语音生成中…
        </p>
      </div>
    )
  }

  if (!audioUrl) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-700 bg-neutral-800/20 p-8 text-center">
        <div className="text-3xl mb-2">🎧</div>
        <p className="text-sm text-neutral-500">生成后音频会显示在这里</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 p-5 space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0) }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onVolumeChange={() => setVolume(audioRef.current?.volume || 1)}
        preload="metadata"
      />

      {/* Controls row */}
      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-500 active:scale-95 flex items-center justify-center text-white transition-all duration-150 shadow-lg shadow-violet-900/40 shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Timeline */}
        <div className="flex-1 space-y-1">
          <div className="relative h-2 rounded-full bg-neutral-700 overflow-hidden">
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Seek"
            />
          </div>
          <div className="flex justify-between text-[10px] text-neutral-500 tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Download */}
      <div className="flex items-center justify-between pt-1 border-t border-neutral-700/50">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-500">音量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              setVolume(v)
              if (audioRef.current) audioRef.current.volume = v
            }}
            className="w-16 h-1 accent-violet-500 cursor-pointer"
            aria-label="Volume"
          />
        </div>
        <a
          href={audioUrl}
          download
          className={[
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
            'bg-neutral-700 hover:bg-neutral-600 text-neutral-200 transition-colors',
          ].join(' ')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载
        </a>
      </div>
    </div>
  )
}
