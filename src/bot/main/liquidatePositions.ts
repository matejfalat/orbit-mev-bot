import {Address} from 'viem'
import {findLiquidablePositions} from '../helpers/findLiquidablePositions'
import {getAllBorrowers} from '../helpers/getAllBorrowers'
import {liquidatePosition} from '../helpers/liquidatePosition'

export const liquidatePositions = async (oTokenAddress: Address) => {
  const borrowers = await getAllBorrowers(oTokenAddress)

  const liquidablePositions = await findLiquidablePositions(
    borrowers,
    oTokenAddress,
  )

  await Promise.all(
    liquidablePositions.map((position) =>
      liquidatePosition(position, oTokenAddress),
    ),
  )
}
