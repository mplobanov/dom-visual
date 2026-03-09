import { useEffect, useMemo, useState } from 'react'
import type {
  Apartment,
  ApartmentStats,
  AvailabilityPeriod,
  MonthlyTypeStat,
  RawData,
} from '../types'

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!
}

/** Build contiguous availability periods from sorted snapshot timestamps. */
function buildPeriods(
  apt: Apartment,
  allTimestamps: string[],
): AvailabilityPeriod[] {
  if (apt.snapshots.length === 0) return []

  const seenSet = new Set(apt.snapshots.map((s) => s.t))
  const priceAt: Record<string, number> = {}
  for (const s of apt.snapshots) priceAt[s.t] = s.price

  const periods: AvailabilityPeriod[] = []
  let periodStart: string | null = null
  let periodPrices: number[] = []

  for (let i = 0; i < allTimestamps.length; i++) {
    const ts = allTimestamps[i]!
    const isAvailable = seenSet.has(ts)

    if (isAvailable) {
      if (periodStart === null) {
        periodStart = ts
        periodPrices = []
      }
      periodPrices.push(priceAt[ts] ?? 0)
    } else {
      if (periodStart !== null) {
        // Availability window closed: end = this non-available snapshot
        const endTs = allTimestamps[i]!
        const startMs = new Date(periodStart).getTime()
        const endMs = new Date(endTs).getTime()
        periods.push({
          start: periodStart,
          end: endTs,
          avgPrice: median(periodPrices),
          durationMs: endMs - startMs,
        })
        periodStart = null
        periodPrices = []
      }
    }
  }

  // Still available at last snapshot — open-ended period
  if (periodStart !== null) {
    const lastTs = allTimestamps[allTimestamps.length - 1]!
    const startMs = new Date(periodStart).getTime()
    const endMs = new Date(lastTs).getTime()
    periods.push({
      start: periodStart,
      end: lastTs,
      avgPrice: median(periodPrices),
      durationMs: endMs - startMs,
    })
  }

  return periods
}

/** Merge periods separated by less than maxGapMs (handles chains iteratively). */
function mergeClosePeriods(
  periods: AvailabilityPeriod[],
  maxGapMs: number,
): AvailabilityPeriod[] {
  if (periods.length <= 1) return periods
  let changed = true
  let current = [...periods]
  while (changed) {
    changed = false
    const merged: AvailabilityPeriod[] = []
    let i = 0
    while (i < current.length) {
      const prev = current[i]!
      const next = current[i + 1]
      if (next && new Date(next.start).getTime() - new Date(prev.end).getTime() < maxGapMs) {
        const prevMs = prev.durationMs
        const nextMs = next.durationMs
        const totalMs = prevMs + nextMs
        merged.push({
          start: prev.start,
          end: next.end,
          durationMs: new Date(next.end).getTime() - new Date(prev.start).getTime(),
          avgPrice: totalMs > 0 ? (prev.avgPrice * prevMs + next.avgPrice * nextMs) / totalMs : 0,
        })
        i += 2
        changed = true
      } else {
        merged.push(prev)
        i++
      }
    }
    current = merged
  }
  return current
}

/** Add stub entries for apartment numbers 1–282 that never appeared in logs. */
function addUnseenApartments(stats: ApartmentStats[]): ApartmentStats[] {
  const numToFloor = new Map<number, number>()
  for (const s of stats) {
    const n = Number(s.apartment.number)
    if (!isNaN(n)) numToFloor.set(n, s.apartment.floor)
  }
  const sortedKnown = [...numToFloor.keys()].sort((a, b) => a - b)

  const stubs: ApartmentStats[] = []
  for (let n = 1; n <= 282; n++) {
    if (numToFloor.has(n)) continue
    // Find nearest known neighbors
    let lo = -1, hi = -1
    for (const k of sortedKnown) {
      if (k < n) lo = k
      else if (k > n && hi === -1) { hi = k; break }
    }
    if (lo === -1 || hi === -1) continue
    const loFloor = numToFloor.get(lo)!
    const hiFloor = numToFloor.get(hi)!
    if (loFloor !== hiFloor) continue
    stubs.push({
      apartment: {
        id: `unseen-${n}`,
        number: String(n),
        floor: loFloor,
        entrance: 'main',
        planningTitle: '',
        category: '',
        roomsNumber: 0,
        areaFull: 0,
        windowViews: [],
        snapshots: [],
      },
      availabilityCount: 0,
      periods: [],
    })
  }
  return [...stats, ...stubs]
}

function computeStats(data: RawData): ApartmentStats[] {
  const stats = data.apartments.map((apt) => ({
    apartment: apt,
    availabilityCount: apt.snapshots.length,
    periods: mergeClosePeriods(buildPeriods(apt, data.snapshotTimestamps), 28 * 86_400_000),
  }))
  return addUnseenApartments(stats)
}

function computeMonthlyTypeStats(stats: ApartmentStats[]): MonthlyTypeStat[] {
  // bucket: month -> planningTitle -> { prices, periodDays }
  const bucket: Record<string, Record<string, { prices: number[]; periodDays: number[] }>> = {}

  for (const s of stats) {
    const title = s.apartment.planningTitle || 'Unknown'
    for (const snap of s.apartment.snapshots) {
      const month = snap.t.slice(0, 7) // 'YYYY-MM'
      if (!bucket[month]) bucket[month] = {}
      if (!bucket[month]![title]) bucket[month]![title] = { prices: [], periodDays: [] }
      bucket[month]![title]!.prices.push(snap.price)
    }
    for (const period of s.periods) {
      const month = period.start.slice(0, 7)
      if (!bucket[month]) bucket[month] = {}
      if (!bucket[month]![title]) bucket[month]![title] = { prices: [], periodDays: [] }
      bucket[month]![title]!.periodDays.push(period.durationMs / (1000 * 60 * 60 * 24))
    }
  }

  const result: MonthlyTypeStat[] = []
  for (const [month, types] of Object.entries(bucket)) {
    for (const [planningTitle, { prices, periodDays }] of Object.entries(types)) {
      result.push({
        month,
        planningTitle,
        medianPrice: median(prices),
        availabilityCount: prices.length,
        avgTimeOnMarketDays:
          periodDays.length > 0
            ? periodDays.reduce((a, b) => a + b, 0) / periodDays.length
            : 0,
      })
    }
  }

  return result.sort((a, b) => a.month.localeCompare(b.month))
}

export interface UseDataResult {
  loading: boolean
  error: string | null
  raw: RawData | null
  stats: ApartmentStats[]
  monthlyTypeStats: MonthlyTypeStat[]
  planningTitles: string[]
}

export function useData(): UseDataResult {
  const [raw, setRaw] = useState<RawData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<RawData>
      })
      .then((data) => {
        setRaw(data)
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  const stats = useMemo(() => (raw ? computeStats(raw) : []), [raw])
  const monthlyTypeStats = useMemo(() => computeMonthlyTypeStats(stats), [stats])
  const planningTitles = useMemo(
    () => [...new Set(stats.map((s) => s.apartment.planningTitle).filter(Boolean))].sort(),
    [stats],
  )

  return { loading, error, raw, stats, monthlyTypeStats, planningTitles }
}
