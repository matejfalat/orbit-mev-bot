import {Address} from 'viem'
import {oTokenAbi} from '../../config/abi'
import {getPublicClient} from '../../utils/blockchain'

export const getAllBorrowers = async (borrowOTokenAddress: Address) => {
  const publicClient = getPublicClient()

  const usdbPositionsFilter = await publicClient.createContractEventFilter({
    abi: oTokenAbi,
    address: borrowOTokenAddress,
    eventName: 'Borrow',
    fromBlock: 0n,
    strict: true,
  })

  const allBorrowLogs = await publicClient.getFilterLogs({
    filter: usdbPositionsFilter,
  })

  return [...new Set(allBorrowLogs.map((log) => log.args.borrower))]
}
