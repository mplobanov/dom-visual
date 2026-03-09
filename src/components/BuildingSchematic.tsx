import { useMemo, useState } from 'react'
import type { ApartmentStats } from '../types'
import { ApartmentCell } from './ApartmentCell'
import { ApartmentDetail } from './ApartmentDetail'

interface Props {
  stats: ApartmentStats[]
  allTimestamps: string[]
}

export function BuildingSchematic({ stats, allTimestamps }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const maxCount = useMemo(
    () => Math.max(1, ...stats.filter((s) => s.periods.length > 0).map((s) => s.periods.length)),
    [stats],
  )

  // Group by floor, sorted descending (top floor first)
  const byFloor = useMemo(() => {
    const map = new Map<number, ApartmentStats[]>()
    for (const s of stats) {
      const floor = s.apartment.floor
      if (!map.has(floor)) map.set(floor, [])
      map.get(floor)!.push(s)
    }
    // Sort apartments within floor by number
    for (const [, apts] of map) {
      apts.sort((a, b) => Number(a.apartment.number) - Number(b.apartment.number))
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [stats])

  const selectedStats = selectedId ? stats.find((s) => s.apartment.id === selectedId) : null

  return (
    <div className="flex gap-4 h-full">
      {/* Schematic */}
      <div className="flex-1 overflow-auto">
        <div className="mb-3 flex items-center gap-6 text-sm text-gray-400">
          <span>Heatmap: </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded inline-block" style={{ background: 'rgb(0,40,220)' }} />
            rarely available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded inline-block" style={{ background: 'rgb(220,80,0)' }} />
            frequently available
          </span>
        </div>
        <div className="space-y-1">
          {byFloor.map(([floor, floorApts]) => (
            <div key={floor} className="flex items-center gap-1">
              <span className="w-8 text-right text-xs text-gray-500 shrink-0">{floor}</span>
              <div className="flex gap-1 flex-wrap">
                {floorApts.map((s) => (
                  <ApartmentCell
                    key={s.apartment.id}
                    stats={s}
                    maxCount={maxCount}
                    isSelected={s.apartment.id === selectedId}
                    onClick={() =>
                      setSelectedId(s.apartment.id === selectedId ? null : s.apartment.id)
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selectedStats && (
        <div className="w-96 shrink-0 border-l border-gray-700 pl-4 overflow-auto">
          <ApartmentDetail
            stats={selectedStats}
            allTimestamps={allTimestamps}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  )
}
