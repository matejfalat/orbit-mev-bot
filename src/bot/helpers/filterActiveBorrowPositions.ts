import {Address} from 'viem'
import {getPublicClient} from '../../utils/blockchain'
import {oTokenAbi} from '../../config/abi'

export const filterActiveBorrowPositions = async (
  borrowers: Address[],
  oTokenAddress: Address,
) => {
  const publicClient = getPublicClient()

  const getBorrowBalancesConfig = borrowers.map(
    (borrower) =>
      ({
        abi: oTokenAbi,
        address: oTokenAddress,
        functionName: 'borrowBalanceCurrent',
        args: [borrower],
      }) as const,
  )

  const borrowBalances = await publicClient.multicall({
    contracts: getBorrowBalancesConfig,
    allowFailure: false,
  })

  const activeBorrowPositions = borrowBalances
    .map((borrowBalance, index) => ({
      borrower: borrowers[index]!,
      borrowBalance,
    }))
    .filter(({borrowBalance}) => borrowBalance !== 0n)

  return activeBorrowPositions
}
