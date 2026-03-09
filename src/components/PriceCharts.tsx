import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyTypeStat } from '../types'

interface Props {
  monthlyTypeStats: MonthlyTypeStat[]
  planningTitles: string[]
}

function fmtPrice(v: number) {
  return `${(v / 1000).toFixed(0)}k ₽`
}

const COLORS = [
  '#34d399', '#60a5fa', '#f472b6', '#facc15', '#a78bfa',
  '#fb923c', '#38bdf8', '#f87171', '#4ade80', '#e879f9',
]

export function PriceCharts({ monthlyTypeStats, planningTitles }: Props) {
  const [selected, setSelected] = useState<string[]>(planningTitles.slice(0, 3))

  const toggle = (title: string) => {
    setSelected((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    )
  }

  // Pivot: month -> { [planningTitle]: stat }
  const months = useMemo(() => [...new Set(monthlyTypeStats.map((s) => s.month))].sort(), [monthlyTypeStats])

  const byMonth = useMemo(() => {
    const map = new Map<string, Map<string, MonthlyTypeStat>>()
    for (const s of monthlyTypeStats) {
      if (!map.has(s.month)) map.set(s.month, new Map())
      map.get(s.month)!.set(s.planningTitle, s)
    }
    return map
  }, [monthlyTypeStats])

  const priceData = useMemo(
    () =>
      months.map((m) => {
        const row: Record<string, string | number> = { month: m.slice(2) }
        for (const t of selected) {
          row[t] = byMonth.get(m)?.get(t)?.medianPrice ?? 0
        }
        return row
      }),
    [months, selected, byMonth],
  )

  const countData = useMemo(
    () =>
      months.map((m) => {
        const row: Record<string, string | number> = { month: m.slice(2) }
        for (const t of selected) {
          row[t] = byMonth.get(m)?.get(t)?.availabilityCount ?? 0
        }
        return row
      }),
    [months, selected, byMonth],
  )

  const timeData = useMemo(
    () =>
      months.map((m) => {
        const row: Record<string, string | number> = { month: m.slice(2) }
        for (const t of selected) {
          row[t] = byMonth.get(m)?.get(t)?.avgTimeOnMarketDays ?? 0
        }
        return row
      }),
    [months, selected, byMonth],
  )

  const axisProps = {
    tick: { fontSize: 10, fill: '#9ca3af' },
  }

  const chartMargin = { top: 8, right: 16, bottom: 4, left: 8 }

  return (
    <div className="space-y-8">
      {/* Type filter */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Filter by planning type:</p>
        <div className="flex flex-wrap gap-2">
          {planningTitles.map((t, i) => {
            const color = COLORS[i % COLORS.length]!
            const active = selected.includes(t)
            return (
              <button
                key={t}
                onClick={() => toggle(t)}
                className={`px-2 py-0.5 rounded text-xs border transition-all ${
                  active ? 'text-white border-transparent' : 'text-gray-500 border-gray-700'
                }`}
                style={active ? { background: color } : {}}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {selected.length === 0 && (
        <p className="text-gray-500 text-sm">Select at least one type above.</p>
      )}

      {selected.length > 0 && (
        <>
          {/* Chart 1: Median price */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Median price per month</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={priceData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" {...axisProps} interval={2} />
                <YAxis
                  {...axisProps}
                  tickFormatter={fmtPrice}
                  width={52}
                />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', fontSize: 11 }}
                  formatter={(v: number) => [`${(v / 1000).toFixed(0)}k ₽`]}
                />
                {selected.map((t, i) => (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={t}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={1.5}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 2: Availability count */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              Availability frequency per month (snapshots)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={countData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" {...axisProps} interval={2} />
                <YAxis {...axisProps} width={36} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', fontSize: 11 }}
                />
                {selected.map((t, i) => (
                  <Bar
                    key={t}
                    dataKey={t}
                    fill={COLORS[i % COLORS.length]}
                    opacity={0.8}
                    stackId="count"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 3: Avg time on market */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              Avg time on market (days) per month
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={timeData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" {...axisProps} interval={2} />
                <YAxis {...axisProps} width={36} tickFormatter={(v: number) => `${v.toFixed(0)}d`} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', fontSize: 11 }}
                  formatter={(v: number) => [`${v.toFixed(1)}d`]}
                />
                {selected.map((t, i) => (
                  <Bar
                    key={t}
                    dataKey={t}
                    fill={COLORS[i % COLORS.length]}
                    opacity={0.8}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
