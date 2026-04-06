'use client'

import { useRef, useState } from 'react'
import AudioTrimmer from './AudioTrimmer'

interface ReferenceAudioUploadProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  onCreateProfile: (name: string) => Promise<void>
  disabled?: boolean
  isCreatingProfile?: boolean
  createdVoiceId?: string
}

const ACCEPTED_TYPES = '.mp3,.wav,.webm,.ogg,audio/mpeg,audio/wav,audio/webm,audio/ogg'

export default function ReferenceAudioUpload({
  files,
  onFilesChange,
  onCreateProfile,
  disabled,
  isCreatingProfile,
  createdVoiceId,
}: ReferenceAudioUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [profileName, setProfileName] = useState('我的声音')
  // Index of file currently being trimmed, -1 = none
  const [trimmingIndex, setTrimmingIndex] = useState<number>(-1)

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return
    const valid = Array.from(newFiles).filter((f) =>
      ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/ogg'].includes(f.type) ||
      ['.mp3', '.wav', '.webm', '.ogg'].some((ext) => f.name.toLowerCase().endsWith(ext))
    )
    onFilesChange([...files, ...valid])
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index))
    if (trimmingIndex === index) setTrimmingIndex(-1)
  }

  function handleTrimmed(trimmedFile: File, index: number) {
    const updated = [...files]
    updated[index] = trimmedFile
    onFilesChange(updated)
    setTrimmingIndex(-1)
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-300 tracking-wide uppercase">
          参考音频
        </label>
        <span className="text-[11px] text-neutral-500">可选 · mp3 / wav</span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={[
          'relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-150',
          isDragging
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800/30',
          disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : '',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <div className="space-y-1">
          <div className="text-2xl">🎙️</div>
          <p className="text-sm text-neutral-400">
            拖入文件或<span className="text-violet-400 font-medium">点击选择</span>
          </p>
          <p className="text-[11px] text-neutral-600">
            上传你的声音样本用于声音克隆
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div key={i}>
              {/* File row */}
              <div className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">🎵</span>
                  <span className="truncate text-neutral-200">{file.name}</span>
                  <span className="shrink-0 text-neutral-500 text-xs">{formatFileSize(file.size)}</span>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTrimmingIndex(trimmingIndex === i ? -1 : i)}
                    disabled={disabled}
                    className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-40 px-1"
                  >
                    {trimmingIndex === i ? '收起' : '裁剪'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    disabled={disabled}
                    className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-40"
                    aria-label={`删除 ${file.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Inline trimmer */}
              {trimmingIndex === i && (
                <div className="mt-2">
                  <AudioTrimmer
                    file={file}
                    onTrimmed={(trimmedFile) => handleTrimmed(trimmedFile, i)}
                    onCancel={() => setTrimmingIndex(-1)}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Profile creation */}
          <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-3 space-y-3">
            <p className="text-xs text-neutral-400">
              根据这些样本创建克隆声音
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="声音名称"
                disabled={disabled || isCreatingProfile}
                className="flex-1 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-violet-500 disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => onCreateProfile(profileName)}
                disabled={disabled || isCreatingProfile || !profileName.trim()}
                className={[
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150',
                  'bg-violet-600 hover:bg-violet-500 text-white',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                ].join(' ')}
              >
                {isCreatingProfile ? '创建中…' : '创建'}
              </button>
            </div>

            {createdVoiceId && (
              <p className="text-xs text-emerald-400">
                ✓ 声音已创建 · ID：<code className="font-mono">{createdVoiceId}</code>
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-neutral-600 leading-relaxed">
        建议使用 30–120 秒的清晰录音，无文件大小限制。
        声音克隆需要 ElevenLabs 付费套餐。
      </p>
    </div>
  )
}
