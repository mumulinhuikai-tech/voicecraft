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

  // Provider selection: 'system' | 'elevenlabs'
  const [provider, setProvider] = useState<'system' | 'elevenlabs'>('system')
  const [systemVoice, setSystemVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)

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
  const canGenerate = text.trim().length > 0 && !isGenerating && !isSpeaking

  // Load voices and history on mount
  useEffect(() => {
    loadVoices()
    loadHistory()
    // Load system TTS voices
    const loadSystemVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      const zhVoices = voices.filter(v => v.lang.startsWith('zh'))
      setAvailableVoices(zhVoices.length > 0 ? zhVoices : voices)
      if (zhVoices.length > 0) setSystemVoice(zhVoices[0])
    }
    loadSystemVoices()
    window.speechSynthesis.onvoiceschanged = loadSystemVoices
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
    const effectiveVoiceId = voiceId || undefined
    const res = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunk,
        emotion,
        speed,
        expressiveness,
        voiceId: effectiveVoiceId,
        providerName: provider,
      }),
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

  function handleStopSpeaking() {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setStatus('idle')
  }

  async function handleGenerate() {
    if (!canGenerate) return

    setStatus('generating')
    setErrorMessage('')

    // System voice: use Web Speech API directly
    if (provider === 'system') {
      window.speechSynthesis.cancel()
      const trimmed = text.trim()
      const utterance = new SpeechSynthesisUtterance(trimmed)
      if (systemVoice) utterance.voice = systemVoice
      utterance.rate = Math.max(0.1, Math.min(10, speed))
      utterance.lang = 'zh-CN'
      utterance.onstart = () => { setIsSpeaking(true); setStatus('success') }
      utterance.onend = () => { setIsSpeaking(false); setStatus('idle') }
      utterance.onerror = () => {
        setIsSpeaking(false)
        setStatus('error')
        setErrorMessage('系统语音播放失败，请检查设备是否支持中文语音。')
      }
      window.speechSynthesis.speak(utterance)
      return
    }

    try {
      const trimmed = text.trim()
      const chunks = splitTextChunks(trimmed, 2500)

      // Generate chunks sequentially with delay to avoid rate limiting
      const blobs: Blob[] = []
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 500))
        blobs.push(await generateChunk(chunks[i]))
      }

      let url: string
      if (blobs.length === 1) {
        // Single chunk: MP3 has correct duration, use directly
        url = URL.createObjectURL(blobs[0])
      } else {
        // Multi-chunk: decode each MP3, merge PCM, encode as WAV
        // Downsampled to mono 22050 Hz to keep memory reasonable (~5 MB/min)
        const TARGET_SAMPLE_RATE = 22050
        const audioCtx = new AudioContext()
        const audioBuffers = await Promise.all(
          blobs.map(async (b) => {
            const ab = await b.arrayBuffer()
            return audioCtx.decodeAudioData(ab)
          })
        )
        audioCtx.close()

        const totalLength = audioBuffers.reduce(
          (sum, b) => sum + Math.ceil(b.length * TARGET_SAMPLE_RATE / b.sampleRate),
          0
        )

        // Merge into mono at target sample rate via OfflineAudioContext
        const offline = new OfflineAudioContext(1, totalLength, TARGET_SAMPLE_RATE)
        let offsetSec = 0
        for (const buf of audioBuffers) {
          const src = offline.createBufferSource()
          src.buffer = buf
          src.connect(offline.destination)
          src.start(offsetSec)
          offsetSec += buf.duration
        }
        const merged = await offline.startRendering()

        const wavBlob = audioBufferToWav(merged)
        url = URL.createObjectURL(wavBlob)
      }

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
  const charLimit = 15000
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

          {/* Provider toggle */}
          <div className="flex rounded-xl overflow-hidden border border-neutral-700 text-sm font-medium">
            <button
              type="button"
              onClick={() => setProvider('system')}
              disabled={isGenerating || isSpeaking}
              className={[
                'flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors',
                provider === 'system'
                  ? 'bg-sky-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200',
              ].join(' ')}
            >
              <span className="text-xs bg-sky-500/30 text-sky-300 px-1.5 py-0.5 rounded">免费</span>
              系统声音
            </button>
            <button
              type="button"
              onClick={() => setProvider('elevenlabs')}
              disabled={isGenerating || isSpeaking}
              className={[
                'flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors',
                provider === 'elevenlabs'
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200',
              ].join(' ')}
            >
              <span className="text-xs bg-violet-500/30 text-violet-300 px-1.5 py-0.5 rounded font-mono">ElevenLabs</span>
              我的声音
            </button>
          </div>

          {/* System voice picker */}
          {provider === 'system' && (
            <div className="space-y-2">
              <p className="text-xs text-neutral-500">选择系统声音（免费·仅播放，不可下载）</p>
              {availableVoices.length === 0 ? (
                <p className="text-xs text-neutral-600">未检测到中文语音，请检查设备语言设置。</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {availableVoices.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setSystemVoice(v)}
                      className={[
                        'rounded-xl border px-3 py-2 text-left transition-all text-sm',
                        systemVoice?.name === v.name
                          ? 'border-sky-500 bg-sky-950/40 text-sky-300'
                          : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300',
                      ].join(' ')}
                    >
                      <span className="font-medium">{v.name}</span>
                      <span className="ml-2 text-[11px] opacity-60">{v.lang}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ElevenLabs voice picker */}
          {provider === 'elevenlabs' && (
            <>
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
            </>
          )}
        </section>

        {/* Generate / Stop Button */}
        {isSpeaking ? (
          <button
            type="button"
            onClick={handleStopSpeaking}
            className="w-full rounded-2xl px-6 py-4 text-base font-semibold transition-all duration-200 bg-red-700 hover:bg-red-600 text-white shadow-xl active:scale-[0.98]"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              停止播放
            </span>
          </button>
        ) : (
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
        )}

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

/** Encode an AudioBuffer as a WAV Blob with correct duration metadata */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16
  const numSamples = buffer.length
  const dataSize = numSamples * numChannels * (bitDepth / 8)
  const bufferSize = 44 + dataSize
  const arrayBuffer = new ArrayBuffer(bufferSize)
  const view = new DataView(arrayBuffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true)
  view.setUint16(32, numChannels * (bitDepth / 8), true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // Interleave channels and write PCM samples
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}
