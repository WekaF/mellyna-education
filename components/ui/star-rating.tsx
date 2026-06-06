'use client'

interface StarRatingProps {
  value: number | null
  onChange?: (value: number | null) => void
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'text-base gap-0.5',
  md: 'text-xl gap-0.5',
  lg: 'text-2xl gap-1',
}

const stars = [1, 2, 3, 4, 5]

export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const classes = sizeMap[size]

  if (onChange) {
    return (
      <div className={`flex ${classes}`} role="group" aria-label="Penilaian bintang">
        {stars.map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star === value ? null : star)}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 rounded-sm transition-transform hover:scale-125 cursor-pointer"
            title={`${star} bintang`}
            aria-label={`${star} bintang${value === star ? ' (terpilih)' : ''}`}
          >
            <span className={star <= (value ?? 0) ? 'text-amber-400' : 'text-slate-300'}>
              ★
            </span>
          </button>
        ))}
      </div>
    )
  }

  if (value === null) return null
  return (
    <div className={`flex ${classes}`} role="img" aria-label={`${value} dari 5 bintang`}>
      {stars.map((star) => (
        <span key={star} className={star <= value ? 'text-amber-400' : 'text-slate-300'}>
          ★
        </span>
      ))}
    </div>
  )
}
