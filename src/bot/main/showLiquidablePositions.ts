import {Address} from 'viem'
import {findLiquidablePositions} from '../helpers/findLiquidablePositions'
import {getAllBorrowers} from '../helpers/getAllBorrowers'

export const showLiquidablePositions = async (borrowOTokenAddress: Address) => {
  const borrowers = await getAllBorrowers(borrowOTokenAddress)

  await findLiquidablePositions(borrowers, borrowOTokenAddress)
}
