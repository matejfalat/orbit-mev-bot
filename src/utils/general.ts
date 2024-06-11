export const MANTISSA_FACTOR = 10n ** 18n

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value != null

export const getUniqueValues = <T>(values: T[]): T[] =>
  Array.from(new Set(values))

export const minBigint = (...args: (bigint | undefined)[]): bigint => {
  const definedArgs = args.filter(isDefined)

  if (!definedArgs.length) {
    throw new Error('No valid bigint provided.')
  }

  return definedArgs.reduce(
    (min, value) => (value < min ? value : min),
    definedArgs[0]!,
  )
}
