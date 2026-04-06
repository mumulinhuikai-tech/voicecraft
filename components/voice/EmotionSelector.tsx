'use client'

import type { Emotion } from '@/types/tts'

const EMOTIONS: Array<{ value: Emotion; label: string; emoji: string; description: string }> = [
  { value: 'calm', label: '平静', emoji: '🌿', description: '沉稳、从容' },
  { value: 'warm', label: '温暖', emoji: '☀️', description: '亲切、真诚' },
  { value: 'serious', label: '庄重', emoji: '📖', description: '权威、慎重' },
  { value: 'joyful', label: '喜悦', emoji: '✨', description: '欢快、活泼' },
  { value: 'sad', label: '哀伤', emoji: '🌧️', description: '柔和、忧郁' },
  { value: 'excited', label: '激昂', emoji: '🔥', description: '热情、充满活力' },
  { value: 'encouraging', label: '鼓励', emoji: '💪', description: '振奋、充满力量' },
]

interface EmotionSelectorProps {
  value: Emotion
  onChange: (emotion: Emotion) => void
  disabled?: boolean
}

export default function EmotionSelector({ value, onChange, disabled }: EmotionSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-300 tracking-wide uppercase">
        情感风格
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {EMOTIONS.map((emotion) => {
          const isSelected = value === emotion.value
          return (
            <button
              key={emotion.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(emotion.value)}
              className={[
                'relative flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isSelected
                  ? 'border-violet-500 bg-violet-500/10 text-violet-200 shadow-[0_0_0_1px_rgba(139,92,246,0.3)]'
                  : 'border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800',
              ].join(' ')}
              aria-pressed={isSelected}
            >
              <span className="text-base leading-none">{emotion.emoji}</span>
              <span className="text-sm font-medium leading-tight">{emotion.label}</span>
              <span className="text-[10px] text-neutral-500 leading-tight">{emotion.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
