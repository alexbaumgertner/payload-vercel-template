import type { Payload } from 'payload'

import type { OtpStore } from './otp'

const internal = { overrideAccess: true, depth: 0 } as const

export function payloadOtpStore(payload: Payload): OtpStore {
  return {
    async countCodesByEmailSince(email, since) {
      const { totalDocs } = await payload.count({
        collection: 'auth-codes',
        where: {
          and: [{ email: { equals: email } }, { createdAt: { greater_than: since.toISOString() } }],
        },
        overrideAccess: true,
      })
      return totalDocs
    },
    async countCodesByIpSince(ip, since) {
      const { totalDocs } = await payload.count({
        collection: 'auth-codes',
        where: {
          and: [
            { requestIp: { equals: ip } },
            { createdAt: { greater_than: since.toISOString() } },
          ],
        },
        overrideAccess: true,
      })
      return totalDocs
    },
    async createCode(record) {
      await payload.create({
        collection: 'auth-codes',
        data: { ...record, expiresAt: record.expiresAt.toISOString(), attempts: 0 },
        ...internal,
      })
    },
    async latestActiveCode(email, now) {
      const { docs } = await payload.find({
        collection: 'auth-codes',
        where: {
          and: [
            { email: { equals: email } },
            { consumedAt: { exists: false } },
            { expiresAt: { greater_than: now.toISOString() } },
          ],
        },
        sort: '-createdAt',
        limit: 1,
        ...internal,
      })
      const doc = docs[0]
      return doc
        ? {
            id: doc.id,
            codeHash: doc.codeHash,
            attempts: doc.attempts ?? 0,
            delivered: Boolean(doc.delivered),
          }
        : null
    },
    async updateCode(id, patch) {
      await payload.update({
        collection: 'auth-codes',
        id,
        data: {
          ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
          ...(patch.consumedAt ? { consumedAt: patch.consumedAt.toISOString() } : {}),
        },
        ...internal,
      })
    },
    async purgeCodesCreatedBefore(cutoff) {
      await payload.delete({
        collection: 'auth-codes',
        where: { createdAt: { less_than: cutoff.toISOString() } },
        ...internal,
      })
    },
    async findUserId(email) {
      const { docs } = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
        ...internal,
      })
      return docs[0]?.id ?? null
    },
  }
}
