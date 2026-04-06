'use client'

import { useState } from 'react'

interface Voice {
  id: string
  name: string
  description?: string
}

interface VoiceIdInputProps {
  value: string
  onChange: (voiceId: string) => void
  voices?: Voice[]
  isLoadingVoices?: boolean
  disabled?: boolean
}

export default function VoiceIdInput({
  value,
  onChange,
  voices = [],
  isLoadingVoices,
  disabled,
}: VoiceIdInputProps) {
  const [showManual, setShowManual] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-300 tracking-wide uppercase">
          声音方案
        </label>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="text-[11px] text-neutral-500 hover:text-violet-400 transition-colors"
        >
          {showManual ? '从列表选择' : '手动输入 ID'}
        </button>
      </div>

      {showManual ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="粘贴 ElevenLabs 声音 ID…"
          disabled={disabled}
          className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-40 font-mono"
        />
      ) : (
        <div>
          {isLoadingVoices ? (
            <div className="rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-neutral-500 animate-pulse">
              加载声音列表中…
            </div>
          ) : voices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-800/20 px-4 py-3 text-sm text-neutral-600 text-center">
              暂无声音 · 请先配置 ELEVENLABS_API_KEY
            </div>
          ) : (
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-4 py-3 text-sm text-neutral-100 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-40"
            >
              <option value="">默认声音（环境变量）</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {value && (
        <p className="text-[11px] text-neutral-500 font-mono truncate">
          ID: {value}
        </p>
      )}
    </div>
  )
}
