import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  userData: defineTable({
    owner: v.string(),
    updatedAt: v.number(),
    data: v.object({
      transactions: v.array(v.object({
        id: v.string(), name: v.string(), category: v.string(),
        kind: v.union(v.literal('expense'), v.literal('income')),
        amount: v.number(), date: v.string()
      })),
      goals: v.array(v.object({
        id: v.string(), name: v.string(), target: v.number(), saved: v.number(),
        color: v.union(v.literal('lime'), v.literal('blue'))
      })),
      reminders: v.array(v.object({
        id: v.string(), title: v.string(), date: v.string(), time: v.string(),
        done: v.boolean(), notified: v.boolean()
      }))
    })
  }).index('by_owner', ['owner']),
  transactions: defineTable({
    owner: v.string(),
    name: v.string(),
    category: v.string(),
    kind: v.union(v.literal('expense'), v.literal('income')),
    amount: v.number(),
    date: v.string()
  }).index('by_owner_date', ['owner', 'date']),
  goals: defineTable({
    owner: v.string(),
    name: v.string(),
    target: v.number(),
    saved: v.number(),
    color: v.union(v.literal('lime'), v.literal('blue'))
  }).index('by_owner', ['owner'])
});
