import { cookies } from "next/headers";
import { CrmShell } from "./crm-shell";
import { PinEntry } from "./pin-entry";
import { pinCookieName, pinSessionIsValid } from "./pin-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = (await cookies()).get(pinCookieName)?.value;
  if (!(await pinSessionIsValid(session))) return <PinEntry />;
  return <CrmShell userEmail="Acceso privado" />;
}
