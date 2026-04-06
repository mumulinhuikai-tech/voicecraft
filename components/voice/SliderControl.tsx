'use client'

interface SliderControlProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
  formatValue?: (value: number) => string
  leftLabel?: string
  rightLabel?: string
}

export default function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  formatValue,
  leftLabel,
  rightLabel,
}: SliderControlProps) {
  const displayValue = formatValue ? formatValue(value) : String(value)
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-300 tracking-wide uppercase">
          {label}
        </label>
        <span className="text-sm font-semibold text-violet-400 tabular-nums">
          {displayValue}
        </span>
      </div>

      <div className="relative">
        {/* Track background */}
        <div className="relative h-2 rounded-full bg-neutral-700 overflow-hidden">
          {/* Fill */}
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-100"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Native range input (transparent, overlaid) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={[
            'absolute inset-0 w-full h-2 opacity-0 cursor-pointer',
            'disabled:cursor-not-allowed',
          ].join(' ')}
          style={{ margin: 0, padding: 0 }}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />

        {/* Thumb indicator */}
        <div
          className={[
            'pointer-events-none absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full',
            'bg-white shadow-md border-2 border-violet-500 transition-all duration-100',
            disabled ? 'opacity-40' : '',
          ].join(' ')}
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>

      {(leftLabel || rightLabel) && (
        <div className="flex justify-between">
          <span className="text-[11px] text-neutral-500">{leftLabel}</span>
          <span className="text-[11px] text-neutral-500">{rightLabel}</span>
        </div>
      )}
    </div>
  )
}
