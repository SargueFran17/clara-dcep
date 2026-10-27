import type { Settings } from '../types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  studyStart: '2026-10-31',
  preEnd: '2026-12-23',
  xmasStart: '2026-12-24',
  xmasEnd: '2026-12-28',
  academyStart: '2026-12-29',
  academyEnd: '2027-04-25',
  nieBlockStart: '2027-04-26',
  nieBlockEnd: '2027-05-30',
  finalReviewStart: '2027-05-17',
  finalReviewEnd: '2027-05-31',
  examDate: '2027-06-01',
  cumulativeTests: ['2027-01-31', '2027-02-28', '2027-03-28', '2027-04-25'],
  mocks: ['2027-05-01', '2027-05-08', '2027-05-15', '2027-05-22', '2027-05-29'],
  theme: 'system',
  spanish: 'tap',
  dailyNewCards: 20,
  dailyReviewCards: 100,
  streakThreshold: 0.8,
}

export const PASS_MARK = 55.7
