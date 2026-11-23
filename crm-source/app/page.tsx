import { redirect } from "next/navigation";
import { accessEnabled, accessIdentity, accessOwnerId } from "./access-identity";
import { cookies } from "next/headers";
import { CrmShell } from "./crm-shell";
import { PinEntry } from "./pin-entry";
import { pinCookieName, pinSessionIsValid } from "./pin-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (accessEnabled()) {
    const identity = await accessIdentity();
    if (!identity || !accessOwnerId()) return <main>Acceso no autorizado.</main>;
    if (identity.role !== "admin") redirect("/profesionales");
    return <CrmShell userEmail={identity.email} />;
  }
  const session = (await cookies()).get(pinCookieName)?.value;
  if (!(await pinSessionIsValid(session))) return <PinEntry />;
  return <CrmShell userEmail="Acceso privado" />;
}
