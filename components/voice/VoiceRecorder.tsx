'use client'

import { useRef, useState, useEffect } from 'react'
import {
  saveRecording,
  listRecordings,
  deleteRecording,
  type RecordingEntry,
} from '@/lib/storage/recordings-db'

interface VoiceRecorderProps {
  onUseRecording: (file: File) => void
}

export default function VoiceRecorder({ onUseRecording }: VoiceRecorderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [recordingName, setRecordingName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedRecordings, setSavedRecordings] = useState<RecordingEntry[]>([])
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(0)
  const durationRef = useRef(0)

  useEffect(() => {
    if (isOpen) loadSaved()
  }, [isOpen])

  async function loadSaved() {
    setIsLoadingSaved(true)
    try { setSavedRecordings(await listRecordings()) }
    catch { /* silent */ }
    finally { setIsLoadingSaved(false) }
  }

  async function startRecording() {
    setError('')
    setPreviewUrl(null)
    setPreviewBlob(null)
    setRecordingTime(0)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        durationRef.current = Math.round((Date.now() - startTimeRef.current) / 1000)
        setPreviewBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        setRecordingName(`录音 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} (${durationRef.current}秒)`)
      }

      mr.start(100)
      startTimeRef.current = Date.now()
      setIsRecording(true)
      timerRef.current = setInterval(() => setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000)), 500)
    } catch {
      setError('无法访问麦克风，请检查浏览器权限。')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  async function handleSave() {
    if (!previewBlob) return
    setIsSaving(true)
    try {
      const entry: RecordingEntry = {
        id: crypto.randomUUID(),
        name: recordingName || '未命名录音',
        blob: previewBlob,
        duration: durationRef.current,
        size: previewBlob.size,
        createdAt: new Date().toISOString(),
      }
      await saveRecording(entry)
      setPreviewUrl(null); setPreviewBlob(null); setRecordingName('')
      await loadSaved()
    } catch { setError('保存失败，请重试。') }
    finally { setIsSaving(false) }
  }

  function useBlob(blob: Blob, name: string) {
    const ext = blob.type.includes('wav') ? '.wav' : blob.type.includes('ogg') ? '.ogg' : '.webm'
    onUseRecording(new File([blob], name + ext, { type: blob.type }))
    setIsOpen(false)
  }

  async function handleUseRecording(entry: RecordingEntry) {
    useBlob(entry.blob, entry.name)
  }

  async function handleDelete(id: string) {
    await deleteRecording(id)
    setSavedRecordings((prev) => prev.filter((r) => r.id !== id))
  }

  function fmt(s: number) {
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }
  function fmtSize(bytes: number) {
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  function fmtDate(iso: string) {
    const d = new Date(iso), diff = (Date.now() - d.getTime()) / 60000
    if (diff < 1) return '刚刚'
    if (diff < 60) return `${Math.floor(diff)} 分钟前`
    if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <button type="button" onClick={() => setIsOpen((v) => !v)}
        className={['flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all',
          isOpen ? 'border-rose-600/40 bg-rose-950/30 text-rose-300'
                  : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200',
        ].join(' ')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
        录音采样
        {savedRecordings.length > 0 && (
          <span className="rounded-full bg-rose-600/30 px-1.5 py-0.5 text-[10px] text-rose-300">{savedRecordings.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="mt-3 rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-4">

          {/* Record */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">录制新样本</p>
            {error && <p className="text-xs text-red-400 bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}

            {!isRecording && !previewUrl && (
              <button type="button" onClick={startRecording}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-3 text-sm font-medium text-white transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-white" />开始录音
              </button>
            )}

            {isRecording && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-rose-950/30 border border-rose-800/40 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-sm text-rose-300 font-medium">录音中</span>
                  </div>
                  <span className="text-sm font-mono text-rose-300 tabular-nums">{fmt(recordingTime)}</span>
                </div>
                <button type="button" onClick={stopRecording}
                  className="w-full rounded-xl bg-neutral-700 hover:bg-neutral-600 px-4 py-3 text-sm font-medium text-neutral-200 transition-colors"
                >
                  停止录音
                </button>
              </div>
            )}

            {previewUrl && previewBlob && (
              <div className="space-y-3">
                <div className="rounded-xl bg-neutral-800 p-3 space-y-2">
                  <p className="text-xs text-neutral-400">试听录制内容</p>
                  <audio src={previewUrl} controls className="w-full h-8" style={{ colorScheme: 'dark' }} />
                </div>
                <input type="text" value={recordingName} onChange={(e) => setRecordingName(e.target.value)}
                  placeholder="录音名称"
                  className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setPreviewUrl(null); setPreviewBlob(null) }}
                    className="flex-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-3 py-2 text-sm text-neutral-400 transition-colors"
                  >重新录制</button>
                  <button type="button" onClick={handleSave} disabled={isSaving}
                    className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-2 text-sm font-medium text-white transition-colors"
                  >{isSaving ? '保存中…' : '保存'}</button>
                  <button type="button" onClick={() => useBlob(previewBlob, recordingName || '录音')}
                    className="flex-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors"
                  >直接使用</button>
                </div>
              </div>
            )}
          </div>

          {/* Saved */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">已保存的样本</p>
            {isLoadingSaved ? (
              <p className="text-xs text-neutral-500 text-center py-3">加载中…</p>
            ) : savedRecordings.length === 0 ? (
              <p className="text-xs text-neutral-600 text-center py-3">暂无保存的录音</p>
            ) : (
              <div className="space-y-1.5">
                {savedRecordings.map((r) => (
                  <div key={r.id} className="group flex items-center gap-2 rounded-lg bg-neutral-800/60 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-200 truncate">{r.name}</p>
                      <p className="text-[10px] text-neutral-500">
                        {r.duration > 0 ? fmt(r.duration) : '–'} · {fmtSize(r.size)} · {fmtDate(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => handleUseRecording(r)}
                        className="rounded-md bg-violet-600/80 hover:bg-violet-600 px-2 py-1 text-[11px] font-medium text-white transition-colors"
                      >使用</button>
                      <button type="button" onClick={() => handleDelete(r.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
