import { redirect } from "next/navigation";
import { getIdentity } from "../../lib/access-context";
import { ProfessionalPortal } from "./professional-shell";
export const dynamic = "force-dynamic";
export default async function ProfessionalsPage() {
  const identity = getIdentity();
  if (!identity) return <main>Acceso no autorizado.</main>;
  if (identity.role === "admin") redirect("/");
  return <ProfessionalPortal role={identity.role} />;
}
