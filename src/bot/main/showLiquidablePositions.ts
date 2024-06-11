import {Address} from 'viem'
import {findLiquidablePositions} from '../helpers/findLiquidablePositions'
import {getAllBorrowers} from '../helpers/getAllBorrowers'

export const showLiquidablePositions = async (oTokenAddress: Address) => {
  const borrowers = await getAllBorrowers(oTokenAddress)

  const liquidablePositions = await findLiquidablePositions(
    borrowers,
    oTokenAddress,
  )

  console.log('Liquidable positions:', liquidablePositions)
}
