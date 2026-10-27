import type { Settings } from '../types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  studyStart: '2026-10-31',
  preEnd: '2026-12-23',
  xmasStart: '2026-12-24',
  xmasEnd: '2026-12-28',
  academyStart: '2026-12-29',
  nieStart: '2027-01-02',
  academyEnd: '2027-05-02',
  nieBlockStart: '2027-05-03',
  nieBlockEnd: '2027-06-06',
  finalReviewStart: '2027-05-17',
  finalReviewEnd: '2027-05-31',
  examDate: '2027-06-01',
  examConfirmed: false,
  // L–V: 1–1,5 h de academia + 1–1,5 h de NIE; sábado y domingo más NIE
  nieMinutes: { mon: 75, tue: 75, wed: 75, thu: 75, fri: 75, sat: 180, sun: 120 },
  cumulativeTests: ['2027-01-31', '2027-02-28', '2027-03-28', '2027-04-25'],
  mocks: ['2027-05-01', '2027-05-08', '2027-05-15', '2027-05-22', '2027-05-29'],
  theme: 'system',
  spanish: 'tap',
  dailyNewCards: 20,
  dailyReviewCards: 100,
  streakThreshold: 0.8,
}

export const PASS_MARK = 55.7
