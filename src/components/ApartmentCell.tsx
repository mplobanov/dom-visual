import type { ApartmentStats } from '../types'

interface Props {
  stats: ApartmentStats
  maxCount: number
  isSelected: boolean
  onClick: () => void
}

function heatColor(ratio: number): string {
  // Blue (cold, rarely available) → Red (hot, frequently available)
  // ratio 0 → blue, 1 → red
  const r = Math.round(ratio * 220)
  const b = Math.round((1 - ratio) * 220)
  const g = Math.round(40 + ratio * 40)
  return `rgb(${r},${g},${b})`
}

export function ApartmentCell({ stats, maxCount, isSelected, onClick }: Props) {
  const unseen = stats.availabilityCount === 0 && stats.periods.length === 0
  const ratio = maxCount > 0 ? stats.periods.length / maxCount : 0
  const bg = unseen ? '#374151' : heatColor(ratio)

  return (
    <button
      onClick={onClick}
      title={`Apt ${stats.apartment.number} — floor ${stats.apartment.floor}\n${stats.apartment.planningTitle}\n${stats.periods.length} availability windows`}
      className={`
        flex flex-col items-center justify-center
        w-14 h-14 rounded text-white text-xs font-mono leading-tight
        border-2 transition-all cursor-pointer
        ${isSelected ? 'border-yellow-300 scale-110 z-10 shadow-lg' : 'border-transparent hover:border-white/40'}
      `}
      style={{ backgroundColor: bg }}
    >
      <span className="font-bold">{stats.apartment.number}</span>
      {!unseen && <span className="opacity-75">{stats.periods.length}x</span>}
    </button>
  )
}
