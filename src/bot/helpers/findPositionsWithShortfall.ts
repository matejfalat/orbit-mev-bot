import {Address} from 'viem'
import {spaceStationAbi} from '../../config/abi'
import {SPACE_STATION_ADDRESS} from '../../config/addresses'
import {getPublicClient} from '../../utils/blockchain'
import {filterActiveBorrowPositions} from './filterActiveBorrowPositions'

export const findPositionsWithShortfall = async (
  borrowers: Address[],
  oTokenAddress: Address,
) => {
  const publicClient = getPublicClient()

  const activeBorrowPositions = await filterActiveBorrowPositions(
    borrowers,
    oTokenAddress,
  )

  const getAccountDetailsConfig = activeBorrowPositions.flatMap(
    ({borrower}) =>
      [
        {
          abi: spaceStationAbi,
          address: SPACE_STATION_ADDRESS,
          functionName: 'getAccountLiquidity',
          args: [borrower],
        },
        {
          abi: spaceStationAbi,
          address: SPACE_STATION_ADDRESS,
          functionName: 'getAssetsIn',
          args: [borrower],
        },
      ] as const,
  )

  const rawAccountDetails = await publicClient.multicall({
    contracts: getAccountDetailsConfig,
    allowFailure: false,
  })

  const {accountShorfalls, accountAssetsIn} = rawAccountDetails.reduce<{
    accountShorfalls: bigint[]
    accountAssetsIn: Address[][]
  }>(
    (acc, value, index) => {
      if (index % 2 === 0) {
        const liquidity = value as [bigint, bigint, bigint]
        acc.accountShorfalls.push(liquidity[2])
      } else {
        acc.accountAssetsIn.push(value as Address[])
      }

      return acc
    },
    {accountShorfalls: [], accountAssetsIn: []},
  )

  const positionsWithShortfall = activeBorrowPositions
    .map((position, index) => ({
      ...position,
      assets: accountAssetsIn[index]!,
      shortfall: accountShorfalls[index]!,
    }))
    .filter((position) => position.shortfall !== 0n)

  return positionsWithShortfall
}
