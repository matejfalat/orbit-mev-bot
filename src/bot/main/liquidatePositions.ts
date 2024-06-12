import {Address} from 'viem'
import {findLiquidablePositions} from '../helpers/findLiquidablePositions'
import {getAllBorrowers} from '../helpers/getAllBorrowers'
import {liquidatePosition} from '../helpers/liquidatePosition'

export const liquidatePositions = async (borrowOTokenAddress: Address) => {
  const borrowers = await getAllBorrowers(borrowOTokenAddress)

  const liquidablePositions = await findLiquidablePositions(
    borrowers,
    borrowOTokenAddress,
  )

  await Promise.all(
    liquidablePositions.map((position) =>
      liquidatePosition(position, borrowOTokenAddress),
    ),
  )
}
