import {Address} from 'viem'
import _ from 'lodash'
import {getPublicClient} from '../../utils/blockchain'
import {MANTISSA_FACTOR} from '../../utils/general'
import {oTokenAbi, oracleRouterAbi, spaceStationAbi} from '../../config/abi'
import {
  ORACLE_ROUTER_ADDRESS,
  SPACE_STATION_ADDRESS,
} from '../../config/addresses'

type Position = {
  assets: Address[]
  borrowBalance: bigint
  borrower: Address
  shortfall: bigint
}

export const prepareLiquidation = async ({
  position: {borrower, borrowBalance, assets: assetsAddresses},
  oTokenAddress,
  closeFactorMantissa,
  borrowTokenPrice,
}: {
  position: Position
  oTokenAddress: Address
  closeFactorMantissa: bigint
  borrowTokenPrice: bigint
}) => {
  const publicClient = getPublicClient()

  const maxAllowedRepayAmount =
    (borrowBalance * closeFactorMantissa) / MANTISSA_FACTOR

  const intendedRepayAmount =
    process.env.REPAY_LIMIT_USD &&
    (BigInt(process.env.REPAY_LIMIT_USD) * MANTISSA_FACTOR ** 2n) /
      borrowTokenPrice

  const repayAmount =
    intendedRepayAmount && intendedRepayAmount < maxAllowedRepayAmount
      ? intendedRepayAmount
      : maxAllowedRepayAmount

  const multicallConfig = assetsAddresses.flatMap(
    (assetAddress) =>
      [
        {
          abi: oTokenAbi,
          address: assetAddress,
          functionName: 'balanceOfUnderlying',
          args: [borrower],
        },
        {
          abi: oTokenAbi,
          address: assetAddress,
          functionName: 'protocolSeizeShareMantissa',
        },
        {
          abi: oTokenAbi,
          address: assetAddress,
          functionName: 'exchangeRateCurrent',
        },
        {
          abi: oracleRouterAbi,
          address: ORACLE_ROUTER_ADDRESS,
          functionName: 'getUnderlyingPrice',
          args: [assetAddress],
        },
      ] as const,
  )

  const data = await publicClient.multicall({
    contracts: multicallConfig,
    allowFailure: false,
  })

  const assets = _.chunk(data, 4)
    .map((assetData, index) => {
      const [
        underlyingBalance,
        protocolSeizeShareMantissa,
        exchangeRateCurrent,
        underlyingPrice,
      ] = assetData as [bigint, bigint, bigint, bigint]

      const address = assetsAddresses[index]!

      const underlyingUsdValue =
        (underlyingBalance * underlyingPrice) / MANTISSA_FACTOR

      return {
        address,
        underlyingBalance,
        underlyingPrice,
        underlyingUsdValue,
        exchangeRateCurrent,
        protocolSeizeShareMantissa,
      }
    })
    .toSorted((a, b) => Number(b.underlyingUsdValue - a.underlyingUsdValue))

  const assetToReceive = assets[0]!

  const seizeAmountResult = await publicClient.readContract({
    abi: spaceStationAbi,
    address: SPACE_STATION_ADDRESS,
    functionName: 'liquidateCalculateSeizeTokens',
    args: [oTokenAddress, assetToReceive.address, repayAmount],
  })

  const seizeTokens = seizeAmountResult[1]
  const seizeAmount =
    (seizeTokens * assetToReceive.exchangeRateCurrent) / MANTISSA_FACTOR
  const seizeUsdValue =
    (seizeAmount * assetToReceive.underlyingPrice) / MANTISSA_FACTOR
  const protocolSeizeTokens =
    (seizeTokens * assetToReceive.protocolSeizeShareMantissa) / MANTISSA_FACTOR
  const receiveTokens = seizeTokens - protocolSeizeTokens
  const receiveAmount =
    (receiveTokens * assetToReceive.exchangeRateCurrent) / MANTISSA_FACTOR
  const receiveUsdValue =
    (receiveAmount * assetToReceive.underlyingPrice) / MANTISSA_FACTOR
  const repayUsdValue = (repayAmount * borrowTokenPrice) / MANTISSA_FACTOR
  const profitUsd = Number(receiveUsdValue - repayUsdValue) / 1e18

  console.log({
    repayUsdValue: Number(repayUsdValue) / 1e18,
    seizeUsdValue: Number(seizeUsdValue) / 1e18,
    receiveUsdValue: Number(receiveUsdValue) / 1e18,
    profitUsd,
    collateralBalance: assetToReceive.underlyingBalance,
    collateralToReceive: assetToReceive.address,
    receiveTokens,
    receiveAmount,
    repayAmount,
  })

  return {
    borrower,
    collateralToken: assetToReceive.address,
    repayAmount,
    profitUsd,
  }
}
