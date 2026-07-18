/** Papéis do sistema (Camada 1 — RBAC). */
export const ROLES = {
  CLIENT: "CLIENT",
  UNIT_ADMIN: "UNIT_ADMIN",
  NETWORK_ADMIN: "NETWORK_ADMIN",
  MASTER: "MASTER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Hierarquia: papéis acima herdam capacidade de gestão dos de baixo. */
const RANK: Record<Role, number> = {
  CLIENT: 0,
  UNIT_ADMIN: 1,
  NETWORK_ADMIN: 2,
  MASTER: 3,
};

export function hasRole(userRole: Role, required: Role): boolean {
  return RANK[userRole] >= RANK[required];
}

export const isClient = (r: Role) => r === ROLES.CLIENT;
export const isUnitAdmin = (r: Role) => hasRole(r, ROLES.UNIT_ADMIN);
export const isNetworkAdmin = (r: Role) => hasRole(r, ROLES.NETWORK_ADMIN);
export const isMaster = (r: Role) => r === ROLES.MASTER;

/** Erro de autorização (papel insuficiente). */
export class ForbiddenError extends Error {
  constructor(message = "Acesso negado") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertRole(userRole: Role, required: Role): void {
  if (!hasRole(userRole, required)) {
    throw new ForbiddenError(`Requer papel ${required}, usuário é ${userRole}`);
  }
}
