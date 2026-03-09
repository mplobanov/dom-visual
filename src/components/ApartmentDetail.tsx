import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ApartmentStats } from '../types'

interface Props {
  stats: ApartmentStats
  allTimestamps: string[]
  onClose: () => void
}

function fmtDate(iso: string) {
  return iso.slice(0, 10)
}

function fmtPrice(v: number) {
  return v.toLocaleString('ru-RU') + ' ₽'
}

function fmtDays(ms: number) {
  const days = ms / (1000 * 60 * 60 * 24)
  if (days < 1) return `${Math.round(ms / (1000 * 60 * 60))}h`
  return `${days.toFixed(1)}d`
}

export function ApartmentDetail({ stats, onClose }: Props) {
  const { apartment, periods } = stats

  const priceData = apartment.snapshots
    .filter((s) => s.price > 0)
    .map((s) => ({ date: s.t.slice(0, 10), price: s.price }))

  // Deduplicate by date for chart readability
  const priceByDate = new Map<string, number>()
  for (const { date, price } of priceData) priceByDate.set(date, price)
  const chartData = [...priceByDate.entries()].map(([date, price]) => ({ date, price }))

  return (
    <div className="text-sm text-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Apt {apartment.number}</h2>
          <p className="text-gray-400">
            Floor {apartment.floor} · {apartment.areaFull} m² · {apartment.roomsNumber} room(s)
          </p>
          <p className="text-gray-400">{apartment.planningTitle}</p>
          {apartment.windowViews.length > 0 && (
            <p className="text-gray-500 text-xs">{apartment.windowViews.join(', ')}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="mb-4">
        <p className="text-gray-400 mb-1">
          <span className="text-white font-medium">{stats.availabilityCount}</span> snapshots ·{' '}
          <span className="text-white font-medium">{periods.length}</span> availability windows
        </p>
      </div>

      {/* Timeline */}
      {periods.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Availability periods
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {periods.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-gray-800 rounded px-2 py-1 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  <span>
                    {fmtDate(p.start)} → {fmtDate(p.end)}
                  </span>
                </div>
                <div className="flex gap-3 text-gray-400">
                  <span>{fmtDays(p.durationMs)}</span>
                  <span>{p.avgPrice > 0 ? fmtPrice(Math.round(p.avgPrice)) : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price chart */}
      {chartData.length > 1 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Price over time</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickFormatter={(v: string) => v.slice(2, 7)}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                width={36}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', fontSize: 11 }}
                formatter={(v: number) => [fmtPrice(v), 'Price']}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#34d399"
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
