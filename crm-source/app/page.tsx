import { redirect } from "next/navigation";
import { CrmShell } from "./crm-shell";
import { getIdentity } from "../lib/access-context";
export const dynamic = "force-dynamic";
export default async function Home() {
  const identity = getIdentity();
  if (!identity) return <main>Acceso no autorizado.</main>;
  if (identity.role !== "admin") redirect("/profesionales");
  return <CrmShell userEmail={identity.email} />;
}
