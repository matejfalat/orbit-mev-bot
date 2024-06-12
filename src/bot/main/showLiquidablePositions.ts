import {Address} from 'viem'
import {findLiquidablePositions} from '../helpers/findLiquidablePositions'
import {getAllBorrowers} from '../helpers/getAllBorrowers'

export const showLiquidablePositions = async (borrowOTokenAddress: Address) => {
  const borrowers = await getAllBorrowers(borrowOTokenAddress)

  const liquidablePositions = await findLiquidablePositions(
    borrowers,
    borrowOTokenAddress,
  )

  if (liquidablePositions.length === 0) {
    console.log('No liquidable positions found')
  }
}
