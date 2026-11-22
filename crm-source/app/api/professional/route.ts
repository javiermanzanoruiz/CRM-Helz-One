import { and, asc, eq, inArray } from "drizzle-orm";
import { getIdentity } from "../../../lib/access-context";
import { OWNER_ID } from "../../../lib/access";
import { getDb } from "../../../db";
import { clients, professionalNotes } from "../../../db/schema";

export const dynamic = "force-dynamic";
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const financialTerms = /\b(?:cuotas?|cobros?|cobrar|pagos?|pagar|pagad[oa]s?|precios?|importes?|ingresos?|gastos?|facturas?|mensualidades?|deudas?|transferencias?|bizum|efectivo|tarjetas?|caja|euros?)\b|€/i;

function clinicalText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .split(/\r?\n|;|(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter((part) => part && !financialTerms.test(part))
    .join(" ");
}

export async function GET() {
  const identity = getIdentity();
  const role = identity?.role === "fisioterapia" || identity?.role === "podologia" ? identity.role : null;
  if (!role) return response({ error: "Inicia sesión para consultar las fichas." }, 401);
  if (!identity?.clientIds.length) return response({ role, clients: [], notes: [] });
  try {
    const db = getDb();
    const [clientRows, noteRows] = await Promise.all([
      db.select({
        id: clients.id,
        ownerId: clients.ownerId,
        name: clients.name,
        status: clients.status,
        service: clients.service,
        frequency: clients.frequency,
        scheduleType: clients.scheduleType,
        trainingSchedule: clients.trainingSchedule,
        importantNotes: clients.importantNotes,
        goal: clients.goal,
        trainingNotes: clients.trainingNotes,
        trainingMetrics: clients.trainingMetrics,
        physioNotes: clients.physioNotes,
      }).from(clients).where(and(eq(clients.ownerId, OWNER_ID), inArray(clients.id, identity!.clientIds))).orderBy(asc(clients.name)).limit(1000),
      db.select({ id: professionalNotes.id, clientId: professionalNotes.clientId, note: professionalNotes.note, createdAt: professionalNotes.createdAt })
        .from(professionalNotes)
        .where(and(eq(professionalNotes.ownerId, OWNER_ID), inArray(professionalNotes.clientId, identity!.clientIds), eq(professionalNotes.professionalRole, role)))
        .orderBy(asc(professionalNotes.createdAt)).limit(5000),
    ]);
    const clinicalClients = clientRows.map((client) => ({
      id: client.id,
      name: client.name,
      status: client.status,
      service: client.service,
      frequency: client.frequency,
      scheduleType: client.scheduleType,
      trainingSchedule: client.trainingSchedule,
      importantNotes: clinicalText(client.importantNotes),
      goal: client.goal,
      trainingNotes: clinicalText(client.trainingNotes),
      trainingMetrics: clinicalText(client.trainingMetrics),
      legacyProfessionalNotes: role === "fisioterapia" ? clinicalText(client.physioNotes) : "",
    }));
    const clinicalNotes = noteRows
      .map((note) => ({ ...note, note: clinicalText(note.note) }))
      .filter((note) => note.note.length > 0);
    return response({ role, clients: clinicalClients, notes: clinicalNotes });
  } catch (error) {
    console.error("Professional notes load failed", error instanceof Error ? error.message : String(error));
    return response({ error: "No se pudieron cargar las fichas profesionales." }, 500);
  }
}

export async function POST(request: Request) {
  const identity = getIdentity();
  const role = identity?.role === "fisioterapia" || identity?.role === "podologia" ? identity.role : null;
  if (!role) return response({ error: "Inicia sesión para guardar anotaciones." }, 401);
  try {
    const body = await request.json() as { clientId?: unknown; note?: unknown };
    const clientId = typeof body.clientId === "string" ? body.clientId.trim().slice(0, 64) : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 3000) : "";
    if (!identity?.clientIds.includes(clientId)) return response({ error: "Ficha no autorizada." }, 403);
    if (!clientId || !note) return response({ error: "Selecciona un cliente y escribe la anotación." }, 400);
    const db = getDb();
    const [client] = await db.select({ id: clients.id, ownerId: clients.ownerId }).from(clients)
      .where(and(eq(clients.id, clientId), and(eq(clients.ownerId, OWNER_ID), inArray(clients.id, identity!.clientIds)))).limit(1);
    if (!client) return response({ error: "No se ha encontrado ese cliente." }, 404);
    const [created] = await db.insert(professionalNotes).values({
      id: crypto.randomUUID(), ownerId: client.ownerId, clientId, professionalRole: role, note,
    }).returning({ id: professionalNotes.id, clientId: professionalNotes.clientId, note: professionalNotes.note, createdAt: professionalNotes.createdAt });
    return response({ record: created }, 201);
  } catch (error) {
    console.error("Professional note save failed", error instanceof Error ? error.message : String(error));
    return response({ error: "No se pudo guardar la anotación." }, 500);
  }
}
