import { describe, expect, it } from 'vitest'
import { formatRecordingTime } from '../src/shared/recording-time.js'

describe('formatRecordingTime', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [1_000, '0:01'],
    [59_999, '0:59'],
    [60_000, '1:00'],
    [3_661_000, '61:01']
  ])('formats %i ms as %s', (elapsedMs, expected) => {
    expect(formatRecordingTime(elapsedMs)).toBe(expected)
  })
})
