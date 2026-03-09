export interface ApartmentSnapshot {
  t: string           // ISO timestamp
  price: number       // rentPrice at this snapshot
  bookingStatus: string
}

export interface Apartment {
  id: string
  number: string
  floor: number
  entrance: string
  planningTitle: string
  category: string
  roomsNumber: number
  areaFull: number
  windowViews: string[]
  snapshots: ApartmentSnapshot[]
}

export interface RawData {
  snapshotTimestamps: string[]
  apartments: Apartment[]
}

/** A contiguous period during which the apartment was available */
export interface AvailabilityPeriod {
  start: string   // ISO
  end: string     // ISO  (= next snapshot after last seen, or last snapshot if still open)
  avgPrice: number
  durationMs: number
}

export interface ApartmentStats {
  apartment: Apartment
  availabilityCount: number   // number of snapshots where available
  periods: AvailabilityPeriod[]
}

export interface MonthlyTypeStat {
  month: string          // 'YYYY-MM'
  planningTitle: string
  medianPrice: number
  availabilityCount: number
  avgTimeOnMarketDays: number
}
