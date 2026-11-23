import { redirect } from "next/navigation";
import { accessEnabled } from "../access-identity";
import { getProfessionalRole } from "../professional-auth";
import { ProfessionalLogin, ProfessionalPortal } from "./professional-shell";

export const dynamic = "force-dynamic";

export default async function ProfessionalsPage() {
  const role = await getProfessionalRole();
  if (accessEnabled() && !role) redirect("/");
  return role ? <ProfessionalPortal role={role} /> : <ProfessionalLogin />;
}
