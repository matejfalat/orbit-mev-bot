import {Address} from 'viem'
import {findPositionsWithShortfall} from './findPositionsWithShortfall'
import {prepareLiquidation} from './prepareLiquidation'
import {getPublicClient} from '../../utils/blockchain'
import {oracleRouterAbi, spaceStationAbi} from '../../config/abi'
import {
  ORACLE_ROUTER_ADDRESS,
  SPACE_STATION_ADDRESS,
} from '../../config/addresses'

export const findLiquidablePositions = async (
  borrowers: Address[],
  oTokenAddress: Address,
) => {
  const publicClient = getPublicClient()

  const protocolParametersPromise = publicClient.multicall({
    allowFailure: false,
    contracts: [
      {
        abi: spaceStationAbi,
        address: SPACE_STATION_ADDRESS,
        functionName: 'closeFactorMantissa',
      },
      {
        abi: spaceStationAbi,
        address: SPACE_STATION_ADDRESS,
        functionName: 'liquidationIncentiveMantissa',
      },
      {
        abi: oracleRouterAbi,
        address: ORACLE_ROUTER_ADDRESS,
        functionName: 'getUnderlyingPrice',
        args: [oTokenAddress],
      },
    ],
  })

  const [
    [closeFactorMantissa, liquidationIncentiveMantissa, borrowTokenPrice],
    positionsWithShortfall,
  ] = await Promise.all([
    protocolParametersPromise,
    findPositionsWithShortfall(borrowers, oTokenAddress),
  ])

  return Promise.all(
    positionsWithShortfall.map((position) =>
      prepareLiquidation({
        position,
        oTokenAddress,
        closeFactorMantissa,
        liquidationIncentiveMantissa,
        borrowTokenPrice,
      }),
    ),
  )
}
