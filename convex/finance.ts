import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

async function requireOwner(ctx: { auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Debes iniciar sesión para acceder a tus datos.');
  return identity.tokenIdentifier;
}

export const listTransactions = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    return ctx.db.query('transactions').withIndex('by_owner_date', q => q.eq('owner', owner)).order('desc').collect();
  }
});

export const addTransaction = mutation({
  args: { name: v.string(), category: v.string(), kind: v.union(v.literal('expense'), v.literal('income')), amount: v.number(), date: v.string() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    if (args.amount <= 0) throw new Error('El monto debe ser mayor a cero.');
    return ctx.db.insert('transactions', { ...args, owner });
  }
});

export const removeTransaction = mutation({
  args: { id: v.id('transactions') },
  handler: async (ctx, { id }) => {
    const owner = await requireOwner(ctx);
    const transaction = await ctx.db.get(id);
    if (transaction?.owner !== owner) throw new Error('Movimiento no encontrado.');
    await ctx.db.delete(id);
  }
});

export const listGoals = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    return ctx.db.query('goals').withIndex('by_owner', q => q.eq('owner', owner)).collect();
  }
});

export const addGoal = mutation({
  args: { name: v.string(), target: v.number(), saved: v.number(), color: v.union(v.literal('lime'), v.literal('blue')) },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    if (args.target <= 0 || args.saved < 0) throw new Error('Revisa los montos de la meta.');
    return ctx.db.insert('goals', { ...args, owner });
  }
});

export const contributeToGoal = mutation({
  args: { id: v.id('goals'), amount: v.number() },
  handler: async (ctx, { id, amount }) => {
    const owner = await requireOwner(ctx);
    if (amount <= 0) throw new Error('El ahorro debe ser mayor a cero.');
    const goal = await ctx.db.get(id);
    if (goal?.owner !== owner) throw new Error('Meta no encontrada.');
    await ctx.db.patch(id, { saved: Math.min(goal.target, goal.saved + amount) });
  }
});

export const removeGoal = mutation({
  args: { id: v.id('goals') },
  handler: async (ctx, { id }) => {
    const owner = await requireOwner(ctx);
    const goal = await ctx.db.get(id);
    if (goal?.owner !== owner) throw new Error('Meta no encontrada.');
    await ctx.db.delete(id);
  }
});

export const getMyData = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    const record = await ctx.db.query('userData').withIndex('by_owner', q => q.eq('owner', owner)).first();
    return record?.data ?? null;
  }
});

export const saveMyData = mutation({
  args: {
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
  },
  handler: async (ctx, { data }) => {
    const owner = await requireOwner(ctx);
    const existing = await ctx.db.query('userData').withIndex('by_owner', q => q.eq('owner', owner)).first();
    if (existing) await ctx.db.patch(existing._id, { data, updatedAt: Date.now() });
    else await ctx.db.insert('userData', { owner, data, updatedAt: Date.now() });
  }
});
