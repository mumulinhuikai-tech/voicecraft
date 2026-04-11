'use client'

import { useState, useEffect, useCallback } from 'react'
import EmotionSelector from '@/components/voice/EmotionSelector'
import SliderControl from '@/components/voice/SliderControl'
import ReferenceAudioUpload from '@/components/voice/ReferenceAudioUpload'
import AudioPlayer from '@/components/voice/AudioPlayer'
import HistoryList from '@/components/voice/HistoryList'
import VoiceIdInput from '@/components/voice/VoiceIdInput'
import VoiceRecorder from '@/components/voice/VoiceRecorder'
import type { Emotion, HistoryItem } from '@/types/tts'
import {
  loadHistory as loadHistoryLocal,
  addToHistory,
  deleteFromHistory,
  clearHistoryStorage,
} from '@/lib/storage/client-history'

type Status = 'idle' | 'generating' | 'success' | 'error'

interface Voice {
  id: string
  name: string
  description?: string
}

export default function VoicePage() {
  // Generation state
  const [text, setText] = useState('')
  const [emotion, setEmotion] = useState<Emotion>('warm')
  const [speed, setSpeed] = useState(1.0)
  const [expressiveness, setExpressiveness] = useState(0.6)
  const [voiceId, setVoiceId] = useState('')

  // Voice profile
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [isCreatingProfile, setIsCreatingProfile] = useState(false)
  const [createdVoiceId, setCreatedVoiceId] = useState<string>()
  const [voices, setVoices] = useState<Voice[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)

  // Result
  const [status, setStatus] = useState<Status>('idle')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [profileError, setProfileError] = useState<string>('')

  // History
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const isGenerating = status === 'generating'
  const canGenerate = text.trim().length > 0 && !isGenerating

  // Load voices and history on mount
  useEffect(() => {
    loadVoices()
    loadHistory()
  }, [])

  async function loadVoices() {
    setIsLoadingVoices(true)
    try {
      const res = await fetch('/api/tts/voice-profile')
      if (res.ok) {
        const data = await res.json()
        setVoices(data.voices || [])
      }
    } catch {
      // Silently fail — voices are optional
    } finally {
      setIsLoadingVoices(false)
    }
  }

  const loadHistory = useCallback(() => {
    setHistory(loadHistoryLocal())
  }, [])

  // Track current blob URL so we can revoke it when a new one is created
  const currentBlobUrlRef = useCallback(() => {}, [])
  void currentBlobUrlRef

  // Split text on sentence boundaries into chunks of max size
  function splitTextChunks(input: string, maxSize: number): string[] {
    if (input.length <= maxSize) return [input]
    const chunks: string[] = []
    const pattern = /[。！？.!?\n]+/g
    const sentences: string[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(input)) !== null) {
      sentences.push(input.slice(lastIndex, match.index + match[0].length))
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < input.length) sentences.push(input.slice(lastIndex))
    let current = ''
    for (const s of sentences) {
      if ((current + s).length > maxSize && current.length > 0) {
        chunks.push(current.trim())
        current = s
      } else {
        current += s
      }
    }
    if (current.trim()) chunks.push(current.trim())
    return chunks.length > 0 ? chunks : [input.slice(0, maxSize)]
  }

  async function generateChunk(chunk: string, attempt = 0): Promise<Blob> {
    const res = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: chunk, emotion, speed, expressiveness, voiceId: voiceId || undefined }),
    })
    if (res.status === 429 && attempt < 2) {
      // Rate limited — wait and retry
      await new Promise(r => setTimeout(r, 3000 + attempt * 2000))
      return generateChunk(chunk, attempt + 1)
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || '生成失败，请重试。')
    }
    return res.blob()
  }

  async function handleGenerate() {
    if (!canGenerate) return

    setStatus('generating')
    setErrorMessage('')

    try {
      const trimmed = text.trim()
      const chunks = splitTextChunks(trimmed, 2500)

      // Generate chunks sequentially with delay to avoid rate limiting
      const blobs: Blob[] = []
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 500))
        blobs.push(await generateChunk(chunks[i]))
      }

      // Concatenate all audio blobs
      const combined = new Blob(blobs, { type: 'audio/mpeg' })
      const url = URL.createObjectURL(combined)

      const id = crypto.randomUUID()
      const language: HistoryItem['language'] = 'zh'

      if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl)
      setAudioUrl(url)
      setStatus('success')

      const item: HistoryItem = {
        id,
        inputText: trimmed,
        textPreview: trimmed.slice(0, 50),
        selectedEmotion: emotion,
        speed,
        expressiveness,
        language,
        audioFilePath: '',
        audioUrl: url,
        provider: 'elevenlabs',
        voiceId: voiceId || '',
        createdAt: new Date().toISOString(),
      }
      setHistory(addToHistory(item))
    } catch (err: unknown) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : '生成失败，请重试。')
    }
  }

  async function handleCreateProfile(name: string) {
    if (referenceFiles.length === 0) return
    setIsCreatingProfile(true)
    setProfileError('')

    const formData = new FormData()
    formData.append('name', name)
    referenceFiles.forEach((f) => formData.append('files', f))

    try {
      const res = await fetch('/api/tts/voice-profile', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCreatedVoiceId(data.voiceId)
      setVoiceId(data.voiceId)
      setProfileError('')
      await loadVoices()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建声音失败，请重试。'
      // Detect ElevenLabs file size error and give actionable guidance
      if (msg.includes('upload_file_size_exceeded') || msg.includes('too large')) {
        setProfileError('文件超过 ElevenLabs 的 11MB 限制。请先点击文件旁的「裁剪」按钮，截取需要的片段后再上传。')
      } else {
        setProfileError(msg)
      }
    } finally {
      setIsCreatingProfile(false)
    }
  }

  function handleDeleteHistory(id: string) {
    setHistory(deleteFromHistory(id))
  }

  function handleClearHistory() {
    clearHistoryStorage()
    setHistory([])
  }

  function handleSelectHistoryItem(item: HistoryItem) {
    setText(item.inputText)
    setEmotion(item.selectedEmotion)
    setSpeed(item.speed)
    setExpressiveness(item.expressiveness)
    setAudioUrl(item.audioUrl)
    setStatus('success')
    setShowHistory(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const charCount = text.length
  const charLimit = 10000
  const charPercent = Math.min(100, (charCount / charLimit) * 100)

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-sm">
              🎙
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">声音工坊</h1>
              <p className="text-[10px] text-neutral-500 leading-none">AI 语音生成器</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className={[
              'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all',
              showHistory
                ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-transparent',
            ].join(' ')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            历史记录
            {history.length > 0 && (
              <span className="ml-0.5 rounded-full bg-violet-600/50 px-1.5 py-0.5 text-[10px] text-violet-200">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4 pb-24">

        {/* History panel */}
        {showHistory && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <h2 className="text-sm font-semibold text-neutral-200">历史记录</h2>
            <HistoryList
              items={history}
              onSelect={handleSelectHistoryItem}
              onDelete={handleDeleteHistory}
              onClearAll={handleClearHistory}
            />
          </section>
        )}

        {/* Text Input */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="voice-text" className="text-sm font-semibold text-neutral-200">
              输入文字
            </label>
            <span
              className={[
                'text-[11px] tabular-nums transition-colors',
                charPercent > 90 ? 'text-red-400' : 'text-neutral-500',
              ].join(' ')}
            >
              {charCount.toLocaleString()} / {charLimit.toLocaleString()}
            </span>
          </div>
          <textarea
            id="voice-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在这里粘贴或输入文字…&#10;&#10;支持中文、英文和混合语言。"
            maxLength={charLimit}
            rows={6}
            disabled={isGenerating}
            className={[
              'w-full rounded-xl bg-neutral-800/60 border px-4 py-3',
              'text-sm text-neutral-100 placeholder-neutral-600 leading-relaxed',
              'focus:outline-none focus:border-violet-500 transition-colors resize-none',
              'disabled:opacity-60',
              text.length > 0 ? 'border-neutral-700' : 'border-neutral-700/50',
            ].join(' ')}
          />
          {/* Char limit bar */}
          <div className="h-0.5 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className={[
                'h-full rounded-full transition-all duration-300',
                charPercent > 90 ? 'bg-red-500' : charPercent > 70 ? 'bg-amber-500' : 'bg-violet-600',
              ].join(' ')}
              style={{ width: `${charPercent}%` }}
            />
          </div>
        </section>

        {/* Voice Settings */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-6">
          <h2 className="text-sm font-semibold text-neutral-200">声音风格</h2>

          <EmotionSelector value={emotion} onChange={setEmotion} disabled={isGenerating} />

          <SliderControl
            label="语速"
            value={speed}
            min={0.5}
            max={2.0}
            step={0.05}
            onChange={setSpeed}
            disabled={isGenerating}
            formatValue={(v) => `${v.toFixed(2)}×`}
            leftLabel="慢"
            rightLabel="快"
          />

          <SliderControl
            label="表现力"
            value={expressiveness}
            min={0}
            max={1}
            step={0.05}
            onChange={setExpressiveness}
            disabled={isGenerating}
            formatValue={(v) => `${Math.round(v * 100)}%`}
            leftLabel="克制"
            rightLabel="夸张"
          />
        </section>

        {/* Voice Profile */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-5">
          <h2 className="text-sm font-semibold text-neutral-200">声音设置</h2>

          <VoiceIdInput
            value={voiceId}
            onChange={setVoiceId}
            voices={voices}
            isLoadingVoices={isLoadingVoices}
            disabled={isGenerating}
          />

          <div className="h-px bg-neutral-800" />

          <VoiceRecorder
            onUseRecording={(file) => setReferenceFiles((prev) => [...prev, file])}
          />

          <ReferenceAudioUpload
            files={referenceFiles}
            onFilesChange={setReferenceFiles}
            onCreateProfile={handleCreateProfile}
            disabled={isGenerating}
            isCreatingProfile={isCreatingProfile}
            createdVoiceId={createdVoiceId}
          />

          {profileError && (
            <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 px-4 py-3 flex items-start gap-2">
              <span className="text-amber-400 shrink-0 mt-0.5">⚠️</span>
              <p className="text-sm text-amber-300">{profileError}</p>
            </div>
          )}
        </section>

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={[
            'w-full rounded-2xl px-6 py-4 text-base font-semibold transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
            canGenerate
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-xl shadow-violet-900/40 active:scale-[0.98]'
              : 'bg-neutral-800 text-neutral-500 cursor-not-allowed',
          ].join(' ')}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              生成中…
            </span>
          ) : (
            '生成语音'
          )}
        </button>

        {/* Error */}
        {status === 'error' && errorMessage && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 flex items-start gap-3">
            <span className="text-red-400 mt-0.5 shrink-0">⚠️</span>
            <p className="text-sm text-red-300">{errorMessage}</p>
          </div>
        )}

        {/* Audio Result */}
        <section className="space-y-3">
          {(status === 'success' || audioUrl) && (
            <h2 className="text-sm font-semibold text-neutral-200">预览</h2>
          )}
          <AudioPlayer
            audioUrl={audioUrl}
            isLoading={isGenerating}
          />
        </section>

      </main>
    </div>
  )
}
