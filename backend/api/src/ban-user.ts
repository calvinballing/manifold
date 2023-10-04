import { authEndpoint, validate } from 'api/helpers'
import { z } from 'zod'
import * as admin from 'firebase-admin'
import { trackPublicEvent } from 'shared/analytics'
import { throwErrorIfNotMod } from 'shared/helpers/auth'
const bodySchema = z.object({
  userId: z.string(),
  unban: z.boolean().optional(),
})
export const banuser = authEndpoint(async (req, auth) => {
  const { userId, unban } = validate(bodySchema, req.body)
  await throwErrorIfNotMod(auth.uid)
  await trackPublicEvent(auth.uid, 'ban user', {
    userId,
  })
  await firestore.doc(`users/${userId}`).update({
    isBannedFromPosting: !unban,
  })
  console.log('updated contract')
  return { success: true }
})
const firestore = admin.firestore()
