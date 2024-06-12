import {Address} from 'viem'
import {findLiquidablePositions} from '../helpers/findLiquidablePositions'
import {getAllBorrowers} from '../helpers/getAllBorrowers'
import {liquidatePosition} from '../helpers/liquidatePosition'
import {getPublicClient, getWebSocketPublicClient} from '../../utils/blockchain'
import {oTokenAbi} from '../../config/abi'
import {isDefined} from '../../utils/general'
import {filterActiveBorrowPositions} from '../helpers/filterActiveBorrowPositions'

const BLOCK_PROCESSING_FREQUENCY = 5

export const runLiquidationBot = async (oTokenAddress: Address) => {
  const publicClient = getPublicClient()
  const webSocketPublicClient = getWebSocketPublicClient()
  const allBorrowers = await getAllBorrowers(oTokenAddress)

  const activeBorrowPositions = await filterActiveBorrowPositions(
    allBorrowers,
    oTokenAddress,
  )

  const borrowers = new Set(
    activeBorrowPositions.map((position) => position.borrower),
  )

  console.log('Borrowers fetched:', borrowers.size)

  publicClient.watchContractEvent({
    address: oTokenAddress,
    abi: oTokenAbi,
    eventName: 'Borrow',
    onLogs: (logs) => {
      const newBorrowers = logs
        .map((log) => log.args.borrower)
        .filter(isDefined)

      newBorrowers.forEach((borrower) => {
        borrowers.add(borrower)
        console.log('New borrower registered:', borrower)
      })
    },
  })

  webSocketPublicClient.watchBlocks({
    blockTag: 'latest',
    onBlock: async (block) => {
      if (Number(block.number) % BLOCK_PROCESSING_FREQUENCY !== 0) {
        return
      }

      try {
        const liquidablePositions = await findLiquidablePositions(
          [...borrowers],
          oTokenAddress,
        )

        console.log(
          `Processing block ${block.number}, borrowers: ${borrowers.size}, liquidable positions: ${liquidablePositions.length}`,
        )

        await Promise.allSettled(
          liquidablePositions.map((position) =>
            liquidatePosition(position, oTokenAddress),
          ),
        )
      } catch (error) {
        console.error(error)
      }
    },
  })
}
