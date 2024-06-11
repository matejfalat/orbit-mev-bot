import {Address} from 'viem'
import {
  getPublicClient,
  getWalletClient,
  walletAccount,
} from '../../utils/blockchain'
import {oErc20Abi} from '../../config/abi'

type LiquidatePositionArgs = {
  borrower: Address
  collateralToken: Address
  repayAmount: bigint
  profitUsd: number
}

export const liquidatePosition = async (
  {borrower, collateralToken, repayAmount, profitUsd}: LiquidatePositionArgs,
  oTokenAddress: Address,
) => {
  const parsedMinProfitUsd = Number(process.env.MIN_PROFIT_USD)
  const minProfitUsd = Number.isNaN(parsedMinProfitUsd) ? 0 : parsedMinProfitUsd

  if (profitUsd < minProfitUsd) {
    console.log(
      `Profit is too low, skipping liquidation. Calculated profit: ${profitUsd} USD`,
    )
    return
  }

  const publicClient = getPublicClient()

  const {result, request} = await publicClient.simulateContract({
    abi: oErc20Abi,
    address: oTokenAddress,
    account: walletAccount,
    functionName: 'liquidateBorrow',
    args: [borrower, repayAmount, collateralToken],
  })

  if (result !== 0n) {
    console.log('Liquidation failed', result)
    return
  }

  if (process.env.EXECUTE_LIQUIDATION === 'true') {
    const walletClient = getWalletClient()

    console.log(`Executing liquidation, calculated profit: ${profitUsd} USD`)

    const hash = await walletClient.writeContract(request)

    await publicClient.waitForTransactionReceipt({hash})

    console.log(`Liquidation executed. Tx hash: ${hash}`)
  } else {
    console.log(
      `Simulating liquidation successful, calculated profit: ${profitUsd} USD`,
    )
  }
}
