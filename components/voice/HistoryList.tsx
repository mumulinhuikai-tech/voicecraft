'use client'

import { useState } from 'react'
import type { HistoryItem } from '@/types/tts'

interface HistoryListProps {
  items: HistoryItem[]
  onSelect: (item: HistoryItem) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

const EMOTION_EMOJI: Record<string, string> = {
  calm: '🌿',
  warm: '☀️',
  serious: '📖',
  joyful: '✨',
  sad: '🌧️',
  excited: '🔥',
  encouraging: '💪',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function HistoryList({ items, onSelect, onDelete, onClearAll }: HistoryListProps) {
  const [confirmClear, setConfirmClear] = useState(false)

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-700 bg-neutral-800/20 p-8 text-center">
        <div className="text-3xl mb-2">📜</div>
        <p className="text-sm text-neutral-500">暂无生成记录</p>
        <p className="text-xs text-neutral-600 mt-1">生成的语音会显示在这里</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">共 {items.length} 条</span>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">确认清空？</span>
            <button
              type="button"
              onClick={() => { onClearAll(); setConfirmClear(false) }}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              确认
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="text-xs text-neutral-500 hover:text-neutral-400"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
          >
            清空全部
          </button>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-3 rounded-xl border border-neutral-700/60 bg-neutral-800/40 p-3 hover:border-neutral-600 hover:bg-neutral-800/70 transition-all duration-150"
          >
            {/* Emotion icon */}
            <div className="mt-0.5 w-8 h-8 rounded-lg bg-neutral-700/60 flex items-center justify-center text-base shrink-0">
              {EMOTION_EMOJI[item.selectedEmotion] || '🎙️'}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1 cursor-pointer" onClick={() => onSelect(item)}>
              <p className="text-sm text-neutral-200 leading-snug line-clamp-2">
                {item.textPreview}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-neutral-500 capitalize">{item.selectedEmotion}</span>
                <span className="text-[10px] text-neutral-600">·</span>
                <span className="text-[10px] text-neutral-500">Speed {item.speed.toFixed(1)}×</span>
                <span className="text-[10px] text-neutral-600">·</span>
                <span className="text-[10px] text-neutral-500">{formatDate(item.createdAt)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={item.audioUrl}
                download
                onClick={(e) => e.stopPropagation()}
                className="w-7 h-7 rounded-lg bg-neutral-700/60 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-all"
                aria-label="Download"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="w-7 h-7 rounded-lg bg-neutral-700/60 hover:bg-red-900/40 flex items-center justify-center text-neutral-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                aria-label="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
