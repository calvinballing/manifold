import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

import { Contract } from './types/contract'
import { User } from './types/user'
import { Bet } from './types/bet'

export const placeBet = functions.runWith({ minInstances: 1 }).https.onCall(
  async (
    data: {
      amount: number
      outcome: string
      contractId: string
    },
    context
  ) => {
    const userId = context?.auth?.uid
    if (!userId) return { status: 'error', message: 'Not authorized' }

    const { amount, outcome, contractId } = data

    if (outcome !== 'YES' && outcome !== 'NO')
      return { status: 'error', message: 'Invalid outcome' }

    // run as transaction to prevent race conditions
    return await firestore.runTransaction(async (transaction) => {
      const userDoc = firestore.doc(`users/${userId}`)
      const userSnap = await transaction.get(userDoc)
      if (!userSnap.exists)
        return { status: 'error', message: 'User not found' }
      const user = userSnap.data() as User

      if (user.balance < amount)
        return { status: 'error', message: 'Insufficient balance' }

      const contractDoc = firestore.doc(`contracts/${contractId}`)
      const contractSnap = await transaction.get(contractDoc)
      if (!contractSnap.exists)
        return { status: 'error', message: 'Invalid contract' }
      const contract = contractSnap.data() as Contract

      const newBetDoc = firestore
        .collection(`contracts/${contractId}/bets`)
        .doc()

      const { newBet, newPot, newDpmWeights, newBalance } = getNewBetInfo(
        user,
        outcome,
        amount,
        contract,
        newBetDoc.id
      )

      transaction.create(newBetDoc, newBet)
      transaction.update(contractDoc, { pot: newPot, dpmWeights: newDpmWeights })
      transaction.update(userDoc, { balance: newBalance })

      return { status: 'success' }
    })
  }
)

const firestore = admin.firestore()

const getNewBetInfo = (
  user: User,
  outcome: 'YES' | 'NO',
  amount: number,
  contract: Contract,
  newBetId: string
) => {
  const { YES: yesPot, NO: noPot } = contract.pot

  const newPot =
    outcome === 'YES'
      ? { YES: yesPot + amount, NO: noPot }
      : { YES: yesPot, NO: noPot + amount }

  const dpmWeight =
    outcome === 'YES'
      ? (amount * noPot ** 2) / (yesPot ** 2 + amount * yesPot)
      : (amount * yesPot ** 2) / (noPot ** 2 + amount * noPot)

  const { YES: yesWeight, NO: noWeight } = contract.dpmWeights

  const newDpmWeights =
    outcome === 'YES'
      ? { YES: yesWeight + dpmWeight, NO: noWeight }
      : { YES: yesWeight, NO: noWeight + dpmWeight }

  const probBefore = yesPot ** 2 / (yesPot ** 2 + noPot ** 2)

  const probAverage =
    (amount +
      noPot * Math.atan(yesPot / noPot) -
      noPot * Math.atan((amount + yesPot) / noPot)) /
    amount

  const probAfter = newPot.YES ** 2 / (newPot.YES ** 2 + newPot.NO ** 2)

  const newBet: Bet = {
    id: newBetId,
    userId: user.id,
    contractId: contract.id,
    amount,
    dpmWeight,
    outcome,
    probBefore,
    probAverage,
    probAfter,
    createdTime: Date.now(),
  }

  const newBalance = user.balance - amount

  return { newBet, newPot, newDpmWeights, newBalance }
}
