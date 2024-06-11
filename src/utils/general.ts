export const MANTISSA_FACTOR = 10n ** 18n

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value != null

export const getUniqueValues = <T>(values: T[]): T[] =>
  Array.from(new Set(values))

export const minBigint = (...args: (bigint | undefined)[]): bigint => {
  const definedArgs = args.filter(isDefined)

  switch (definedArgs.length) {
    case 0:
      throw new Error('No valid bigint provided.')
    case 1:
      return definedArgs[0]!
    case 2:
      return definedArgs[0]! < definedArgs[1]!
        ? definedArgs[0]!
        : definedArgs[1]!
    default:
      return minBigint(definedArgs[0], minBigint(...definedArgs.slice(1)))
  }
}
