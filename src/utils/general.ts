export const MANTISSA_FACTOR = 10n ** 18n

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value != null

export const getUniqueValues = <T>(values: T[]): T[] =>
  Array.from(new Set(values))
