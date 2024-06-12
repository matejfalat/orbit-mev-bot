import {Address} from 'viem'
import _ from 'lodash'
import {getPublicClient} from '../../utils/blockchain'
import {MANTISSA_FACTOR, minBigint} from '../../utils/general'
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

// The amount of seized tokens can't exceed user's balance and the exact amount is calculated based on floating oToken exchange rate.
// When seizing the collateral fully, we subtract a small part from the repay amount to prevent liquidation from failing.
// Scaled by 1e18.
const MAX_REPAY_AMOUNT_MARGIN_MANTISSA = 999_000_000_000_000_000n

const getMostValuableAsset = async (
  borrower: Address,
  assetsAddresses: Address[],
) => {
  const publicClient = getPublicClient()

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
          abi: oTokenAbi,
          address: assetAddress,
          functionName: 'balanceOf',
          args: [borrower],
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

  const assets = _.chunk(data, 5)
    .map((assetData, index) => {
      const [
        underlyingBalance,
        protocolSeizeShareMantissa,
        exchangeRateCurrent,
        balance,
        underlyingPrice,
      ] = assetData as [bigint, bigint, bigint, bigint, bigint]

      const address = assetsAddresses[index]!

      const underlyingUsdValue =
        (underlyingBalance * underlyingPrice) / MANTISSA_FACTOR

      return {
        address,
        balance,
        underlyingBalance,
        underlyingPrice,
        underlyingUsdValue,
        exchangeRateCurrent,
        protocolSeizeShareMantissa,
      }
    })
    .toSorted((a, b) => Number(b.underlyingUsdValue - a.underlyingUsdValue))

  return assets[0]!
}

export const prepareLiquidation = async ({
  position: {borrower, borrowBalance, assets: assetsAddresses},
  borrowOTokenAddress,
  closeFactorMantissa,
  liquidationIncentiveMantissa,
  borrowTokenPrice,
}: {
  position: Position
  borrowOTokenAddress: Address
  closeFactorMantissa: bigint
  liquidationIncentiveMantissa: bigint
  borrowTokenPrice: bigint
}) => {
  const publicClient = getPublicClient()

  const assetToReceive = await getMostValuableAsset(borrower, assetsAddresses)

  const rawCollateralBalanceMaxRepayAmount =
    (assetToReceive.underlyingUsdValue * MAX_REPAY_AMOUNT_MARGIN_MANTISSA) /
    borrowTokenPrice

  const collateralBalanceMaxRepayAmount =
    (rawCollateralBalanceMaxRepayAmount * MANTISSA_FACTOR) /
    liquidationIncentiveMantissa

  const closeFactorMaxRepayAmount =
    (borrowBalance * closeFactorMantissa) / MANTISSA_FACTOR

  const intendedMaxRepayAmount = process.env.REPAY_LIMIT_USD
    ? (BigInt(process.env.REPAY_LIMIT_USD) * MANTISSA_FACTOR ** 2n) /
      borrowTokenPrice
    : undefined

  const repayAmount = minBigint(
    intendedMaxRepayAmount,
    closeFactorMaxRepayAmount,
    collateralBalanceMaxRepayAmount,
  )

  const [, seizeAmountResult] = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      {
        abi: oTokenAbi,
        address: assetToReceive.address,
        functionName: 'accrueInterest',
      },
      {
        abi: spaceStationAbi,
        address: SPACE_STATION_ADDRESS,
        functionName: 'liquidateCalculateSeizeTokens',
        args: [borrowOTokenAddress, assetToReceive.address, repayAmount],
      },
    ],
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

  console.log('Liquidable position found:', {
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
