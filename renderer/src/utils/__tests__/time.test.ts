import { describe, expect, it } from 'vitest'
import {
  TIME_INCOMPLETE_ERROR,
  TIME_RANGE_ERROR,
  formatMinutesHM,
  maskTimeInput,
  parseTimeHM,
  timeFieldError
} from '../time'

describe('maskTimeInput', () => {
  it.each([
    ['', ''],
    ['0', '0'],
    ['08', '08'],
    ['080', '08:0'],
    ['0800', '08:00'],
    ['08001', '08:00'],
    ['8:', '08'],
    ['8:3', '08:3'],
    ['08:30', '08:30'],
    ['ab12cd34', '12:34'],
    ['2500', '25:00']
  ])('%j → %j', (input, expected) => {
    expect(maskTimeInput(input)).toBe(expected)
  })
})

describe('parseTimeHM', () => {
  it.each([
    ['00:00', 0],
    ['08:00', 480],
    ['02:00', 120],
    ['12:30', 750],
    ['23:59', 1439],
    [' 08:00 ', 480]
  ])('%j → %i', (input, expected) => {
    expect(parseTimeHM(input)).toBe(expected)
  })

  it.each(['24:00', '23:60', '8:00', '08:0', '0800', '', 'ab:cd', '08:00:00', '-1:00'])('%j → null', (input) => {
    expect(parseTimeHM(input)).toBeNull()
  })
})

describe('formatMinutesHM', () => {
  it.each([
    [0, '00:00'],
    [120, '02:00'],
    [480, '08:00'],
    [750, '12:30'],
    [1439, '23:59']
  ])('%i → %j', (minutes, expected) => {
    expect(formatMinutesHM(minutes)).toBe(expected)
  })

  it('ida y vuelta con parseTimeHM', () => {
    for (const n of [0, 1, 59, 60, 479, 480, 1439]) {
      expect(parseTimeHM(formatMinutesHM(n))).toBe(n)
    }
  })
})

describe('timeFieldError', () => {
  it.each([
    ['08:00', false, null],
    ['08:00', true, null],
    ['', false, null],
    ['08', false, null],
    ['', true, TIME_INCOMPLETE_ERROR],
    ['08:3', true, TIME_INCOMPLETE_ERROR],
    ['25:00', false, TIME_RANGE_ERROR],
    ['12:60', true, TIME_RANGE_ERROR]
  ])('(%j, %s) → %j', (text, submitted, expected) => {
    expect(timeFieldError(text, submitted)).toBe(expected)
  })

  it('los textos de error son los acordados', () => {
    expect(TIME_RANGE_ERROR).toBe('Ingresá una hora entre 00:00 y 23:59.')
    expect(TIME_INCOMPLETE_ERROR).toBe('Completá la hora (HH:MM).')
  })
})
