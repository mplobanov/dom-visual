import { useState } from 'react'
import { BuildingSchematic } from './components/BuildingSchematic'
import { PriceCharts } from './components/PriceCharts'
import { useData } from './hooks/useData'

type Tab = 'schematic' | 'charts'

export default function App() {
  const { loading, error, raw, stats, monthlyTypeStats, planningTitles } = useData()
  const [tab, setTab] = useState<Tab>('schematic')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        Loading data…
      </div>
    )
  }

  if (error || !raw) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">
        Error: {error ?? 'No data. Run python scripts/etl.py first.'}
      </div>
    )
  }

  const firstTs = raw.snapshotTimestamps[0]?.slice(0, 10) ?? '?'
  const lastTs = raw.snapshotTimestamps[raw.snapshotTimestamps.length - 1]?.slice(0, 10) ?? '?'

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="px-6 py-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Лайнер — Rent Monitor</h1>
          <p className="text-xs text-gray-500">
            {raw.snapshotTimestamps.length} snapshots · {stats.length} apartments ·{' '}
            {firstTs} → {lastTs}
          </p>
        </div>
        <nav className="flex gap-1">
          {(['schematic', 'charts'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-sm transition-colors capitalize ${
                tab === t
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden p-4">
        {tab === 'schematic' && (
          <BuildingSchematic stats={stats} allTimestamps={raw.snapshotTimestamps} />
        )}
        {tab === 'charts' && (
          <div className="overflow-auto h-full">
            <PriceCharts monthlyTypeStats={monthlyTypeStats} planningTitles={planningTitles} />
          </div>
        )}
      </main>
    </div>
  )
}
