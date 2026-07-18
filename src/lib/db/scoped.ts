import { prisma } from "@/lib/prisma";

/**
 * Modelos tenant-scoped: toda query passa a filtrar/injetar tenantId
 * automaticamente. Enforcement PRIMÁRIO de isolamento multi-tenant
 * (RLS no Postgres é a defesa em profundidade).
 */
const TENANT_MODELS = new Set([
  "Barber",
  "Service",
  "Product",
  "ComboPlan",
  "Client",
  "ClientSubscription",
  "Appointment",
  "Sale",
  "Payment",
  "FinancialEntry",
  "Campaign",
  "ClientInvite",
]);

const READ_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

/**
 * Retorna um Prisma Client escopado ao tenant. Use SEMPRE este client nas
 * queries de negócio; nunca `prisma` cru para dados tenant-scoped.
 */
export function getScopedDb(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }
          const a = (args ?? {}) as Record<string, unknown>;

          if (READ_OPS.has(operation)) {
            a.where = { ...((a.where as object) ?? {}), tenantId };
          } else if (operation === "create") {
            a.data = { ...((a.data as object) ?? {}), tenantId };
          } else if (operation === "createMany") {
            const data = a.data;
            if (Array.isArray(data)) {
              a.data = data.map((d) => ({ ...(d as object), tenantId }));
            } else if (data) {
              a.data = { ...(data as object), tenantId };
            }
          } else if (operation === "upsert") {
            a.where = { ...((a.where as object) ?? {}), tenantId };
            a.create = { ...((a.create as object) ?? {}), tenantId };
          }
          return query(a);
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof getScopedDb>;
