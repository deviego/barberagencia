import { getSessionUser } from "@/lib/auth/session";
import { isMaster } from "@/lib/rbac";
import { safeEqual } from "@/lib/crypto/safe-equal";

/**
 * Autoriza uma requisição de relatório por:
 *  - token compartilhado (gateway), enviado no header `x-report-token` (constant-time); OU
 *  - sessão MASTER (download no painel).
 * O token NÃO é aceito via query string (evita vazamento em logs/Referer/histórico).
 */
export async function authorizeReport(request: Request): Promise<boolean> {
  const token = process.env.REPORT_TOKEN;
  const header = request.headers.get("x-report-token");
  if (token && header && safeEqual(header, token)) return true;
  const user = await getSessionUser();
  return !!user?.role && isMaster(user.role);
}
