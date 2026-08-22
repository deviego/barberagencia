import { prisma } from "@/lib/prisma";

/**
 * ⚠️ NÃO EM USO no runtime. O isolamento multi-tenant EFETIVO é o RLS no Postgres
 * (policies com `auth_tenant_id()`) somado ao filtro `tenant_id` manual nas queries
 * supabase-js. Este helper (Prisma) existe apenas como alternativa histórica e não é
 * importado em lugar nenhum. Se for adotar, torná-lo a via única; caso contrário, remover.
 *
 * Modelos tenant-scoped: toda query passaria a filtrar/injetar tenantId automaticamente.
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
 * Retorna um Prisma Client escopado ao tenant. (Atualmente não utilizado — ver nota acima.)
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
