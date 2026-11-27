import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getPinOwnerId } from "../../pin-auth";
import { getDb } from "../../../db";
import { checkins, clients, crossSellOffers, leads, monthlyDues, professionalNotes, supplementPlans, tanitaAssessments, tasks, transactions } from "../../../db/schema";

export const dynamic = "force-dynamic";

const clientStatuses = new Set(["active", "paused", "inactive"]);
const leadStages = new Set([
  "nuevo",
  "contactado",
  "valoracion",
  "propuesta",
  "seguimiento",
  "ganado",
  "perdido",
]);
const transactionDirections = new Set(["entrada", "salida"]);
const paymentMethods = new Set([
  "transferencia",
  "tarjeta",
  "efectivo",
  "domiciliacion",
  "otro",
]);
const crossSellCategories = new Set(["valoracion", "suplementacion", "merchandising", "otro"]);
const crossSellStatuses = new Set(["planificada", "activa", "pausada", "archivada"]);
const text = (value: unknown, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const integer = (value: unknown, min: number, max: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const decimal = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const response = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

async function ownerIdOrNull() {
  const user = await getChatGPTUser();
  return user?.userId ?? await getPinOwnerId();
}

export async function GET(request: Request) {
  const ownerId = await ownerIdOrNull();
  if (!ownerId) return response({ error: "Inicia sesión para continuar." }, 401);

  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const month = new URL(request.url).searchParams.get("month") || today.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return response({ error: "Mes no válido." }, 400);
    const clientRows = await db.select().from(clients).where(eq(clients.ownerId, ownerId)).orderBy(desc(clients.updatedAt)).limit(1000);
    const eligibleClients = clientRows.filter((client) =>
      client.status === "active" && (!client.startDate || client.startDate.slice(0, 7) <= month),
    );
    if (eligibleClients.length) {
      const dueRows = eligibleClients.map((client) => ({
          id: crypto.randomUUID(), ownerId, clientId: client.id, servicePeriod: month,
          amountDueCents: client.monthlyFeeCents,
      }));
      for (let index = 0; index < dueRows.length; index += 20) {
        await db.insert(monthlyDues).values(dueRows.slice(index, index + 20)).onConflictDoNothing();
      }
    }
    const [leadRows, checkinRows, taskRows, transactionRows, dueRows, offerRows, supplementRows, tanitaRows, professionalNoteRows] =
      await Promise.all([
        db.select().from(leads).where(eq(leads.ownerId, ownerId)).orderBy(desc(leads.updatedAt)).limit(1000),
        db.select().from(checkins).where(eq(checkins.ownerId, ownerId)).orderBy(desc(checkins.sessionDate)).limit(3000),
        db.select().from(tasks).where(eq(tasks.ownerId, ownerId)).orderBy(tasks.dueDate).limit(2000),
        db.select().from(transactions).where(eq(transactions.ownerId, ownerId)).orderBy(desc(transactions.transactionDate)).limit(5000),
        db.select().from(monthlyDues).where(and(eq(monthlyDues.ownerId, ownerId), eq(monthlyDues.servicePeriod, month))).limit(1000),
        db.select().from(crossSellOffers).where(eq(crossSellOffers.ownerId, ownerId)).orderBy(desc(crossSellOffers.updatedAt)).limit(1000),
        db.select().from(supplementPlans).where(eq(supplementPlans.ownerId, ownerId)).orderBy(desc(supplementPlans.servicePeriod)).limit(120),
        db.select().from(tanitaAssessments).where(eq(tanitaAssessments.ownerId, ownerId)).orderBy(desc(tanitaAssessments.assessmentDate)).limit(5000),
        db.select().from(professionalNotes).where(eq(professionalNotes.ownerId, ownerId)).orderBy(desc(professionalNotes.createdAt)).limit(5000),
      ]);
    return response({
      clients: clientRows,
      leads: leadRows,
      checkins: checkinRows,
      tasks: taskRows,
      transactions: transactionRows,
      monthlyDues: dueRows,
      crossSellOffers: offerRows,
      supplementPlans: supplementRows,
      tanitaAssessments: tanitaRows,
      professionalNotes: professionalNoteRows,
    });
  } catch (error) {
    console.error("CRM data load failed", error instanceof Error ? error.message : String(error));
    return response({ error: "No se pudieron cargar los datos del CRM." }, 500);
  }
}

export async function DELETE(request: Request) {
  const ownerId = await ownerIdOrNull();
  if (!ownerId) return response({ error: "Inicia sesión para continuar." }, 401);
  try {
    const body = (await request.json()) as { id?: unknown };
    const id = text(body.id, 64);
    if (!id) return response({ error: "Falta el identificador del cliente." }, 400);
    const db = getDb();
    const [client] = await db.select({ id: clients.id }).from(clients)
      .where(and(eq(clients.id, id), eq(clients.ownerId, ownerId))).limit(1);
    if (!client) return response({ error: "Cliente no encontrado." }, 404);

    // Keep accounting history while removing the personal link to the deleted client.
    await db.update(transactions).set({ clientId: null })
      .where(and(eq(transactions.ownerId, ownerId), eq(transactions.clientId, id)));
    await db.delete(checkins).where(and(eq(checkins.ownerId, ownerId), eq(checkins.clientId, id)));
    await db.delete(tasks).where(and(eq(tasks.ownerId, ownerId), eq(tasks.clientId, id)));
    await db.delete(tanitaAssessments).where(and(eq(tanitaAssessments.ownerId, ownerId), eq(tanitaAssessments.clientId, id)));
    await db.delete(professionalNotes).where(and(eq(professionalNotes.ownerId, ownerId), eq(professionalNotes.clientId, id)));
    await db.delete(monthlyDues).where(and(eq(monthlyDues.ownerId, ownerId), eq(monthlyDues.clientId, id)));
    await db.delete(clients).where(and(eq(clients.id, id), eq(clients.ownerId, ownerId)));
    return response({ ok: true });
  } catch (error) {
    console.error("CRM client deletion failed", error instanceof Error ? error.message : String(error));
    return response({ error: "No se pudo eliminar el cliente." }, 500);
  }
}

export async function POST(request: Request) {
  const ownerId = await ownerIdOrNull();
  if (!ownerId) return response({ error: "Inicia sesión para continuar." }, 401);

  try {
    const body = (await request.json()) as { entity?: string; data?: Record<string, unknown> };
    const data = body.data ?? {};
    const id = crypto.randomUUID();
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    if (body.entity === "client") {
      const name = text(data.name, 120);
      const monthlyFee = integer(data.monthlyFeeCents, 0, 100_000_000);
      if (!name || monthlyFee === null) {
        return response({ error: "Completa nombre y cuota mensual." }, 400);
      }
      const status = text(data.status, 20) || "active";
      if (!clientStatuses.has(status)) return response({ error: "Estado de cliente no válido." }, 400);
      const [created] = await db.insert(clients).values({
        id,
        ownerId,
        name,
        phone: text(data.phone, 40),
        email: text(data.email, 160),
        status,
        service: text(data.service, 100),
        monthlyFeeCents: monthlyFee,
        feeFrozen: data.feeFrozen === true ? 1 : 0,
        paymentMethod: paymentMethods.has(text(data.paymentMethod, 30)) ? text(data.paymentMethod, 30) : "efectivo",
        frequency: text(data.frequency, 30),
        scheduleType: text(data.scheduleType, 20) === "variable" ? "variable" : "fijo",
        trainingSchedule: text(data.trainingSchedule, 500),
        startDate: text(data.startDate, 10),
        nextReviewDate: text(data.nextReviewDate, 10),
        importantNotes: text(data.importantNotes, 500),
        goal: text(data.goal, 500),
        trainingNotes: text(data.trainingNotes, 1500),
        trainingMetrics: text(data.trainingMetrics, 2000),
        physioNotes: text(data.physioNotes, 2000),
        testimonialConsent: data.testimonialConsent === true ? 1 : 0,
      }).returning();
      return response({ record: created }, 201);
    }

    if (body.entity === "cross_sell_offer") {
      const name = text(data.name, 120);
      const category = text(data.category, 30) || "otro";
      const status = text(data.status, 20) || "planificada";
      const unitPriceCents = integer(data.unitPriceCents, 0, 100_000_000);
      const unitCostCents = integer(data.unitCostCents, 0, 100_000_000);
      const expectedUnits = integer(data.expectedUnits, 0, 100_000);
      const initialInvestmentCents = integer(data.initialInvestmentCents, 0, 1_000_000_000);
      if (!name || !crossSellCategories.has(category) || !crossSellStatuses.has(status) || unitPriceCents === null || unitCostCents === null || expectedUnits === null || initialInvestmentCents === null) {
        return response({ error: "Revisa el nombre, la categoría, el precio y las previsiones." }, 400);
      }
      const [created] = await db.insert(crossSellOffers).values({
        id, ownerId, name, category, status, unitPriceCents, unitCostCents,
        expectedUnits, initialInvestmentCents, notes: text(data.notes, 1000),
      }).returning();
      return response({ record: created }, 201);
    }

    if (body.entity === "supplement_plan") {
      const servicePeriod = text(data.servicePeriod, 7);
      const investmentCents = integer(data.investmentCents, 0, 1_000_000_000);
      if (!/^\d{4}-\d{2}$/.test(servicePeriod) || investmentCents === null) {
        return response({ error: "Indica un mes válido y una inversión mensual igual o mayor que cero." }, 400);
      }
      const [created] = await db.insert(supplementPlans).values({
        id, ownerId, servicePeriod, investmentCents,
      }).returning();
      return response({ record: created }, 201);
    }

    if (body.entity === "tanita_assessment") {
      const clientId = text(data.clientId, 64);
      const assessmentDate = text(data.assessmentDate, 10) || today;
      const weightKg = decimal(data.weightKg, 0, 500);
      const bodyFatPercent = decimal(data.bodyFatPercent, 0, 100);
      const muscleMassKg = decimal(data.muscleMassKg, 0, 300);
      const visceralFat = data.visceralFat === "" || data.visceralFat == null ? null : integer(data.visceralFat, 0, 100);
      const bmi = decimal(data.bmi, 0, 100);
      const basalMetabolismKcal = data.basalMetabolismKcal === "" || data.basalMetabolismKcal == null ? null : integer(data.basalMetabolismKcal, 0, 10000);
      const bodyWaterPercent = decimal(data.bodyWaterPercent, 0, 100);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(assessmentDate) || !clientId || [weightKg, bodyFatPercent, muscleMassKg, bmi, bodyWaterPercent].includes(undefined) || visceralFat === undefined || basalMetabolismKcal === undefined) {
        return response({ error: "Revisa la fecha y los valores de la valoración." }, 400);
      }
      const [client] = await db.select({ id: clients.id, paymentMethod: clients.paymentMethod }).from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId))).limit(1);
      if (!client) return response({ error: "Cliente no válido." }, 400);
      const paid = data.paid === true;
      const paymentMethod = paymentMethods.has(text(data.paymentMethod, 30)) ? text(data.paymentMethod, 30) : client.paymentMethod || "efectivo";
      const [created] = await db.insert(tanitaAssessments).values({
        id, ownerId, clientId, assessmentDate, weightKg, bodyFatPercent, muscleMassKg,
        visceralFat, bmi, basalMetabolismKcal, bodyWaterPercent, priceCents: 2000,
        paid: paid ? 1 : 0, paymentMethod, notes: text(data.notes, 1000),
      }).returning();
      if (paid) {
        await db.insert(transactions).values({
          id: `tanita-${id}`, ownerId, transactionDate: assessmentDate, direction: "entrada",
          category: "Valoración Tanita", amountCents: 2000,
          description: `Valoración Tanita · ${assessmentDate}`, clientId,
          servicePeriod: assessmentDate.slice(0, 7), paymentMethod, reference: id,
        });
      }
      return response({ record: created }, 201);
    }

    if (body.entity === "lead") {
      const name = text(data.name, 120);
      if (!name) return response({ error: "El nombre del contacto es obligatorio." }, 400);
      const stage = text(data.stage, 30) || "nuevo";
      if (!leadStages.has(stage)) return response({ error: "Etapa no válida." }, 400);
      const [created] = await db.insert(leads).values({
        id,
        ownerId,
        name,
        contact: text(data.contact, 160),
        source: text(data.source, 100),
        objective: text(data.objective, 400),
        stage,
        nextActionDate: text(data.nextActionDate, 10),
        notes: text(data.notes, 1000),
      }).returning();
      return response({ record: created }, 201);
    }

    if (body.entity === "checkin") {
      const clientId = text(data.clientId, 64);
      const sessionDate = text(data.sessionDate, 10) || today;
      const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId))).limit(1);
      if (!client) return response({ error: "Selecciona un cliente válido." }, 400);
      const effort = data.effort === "" || data.effort == null ? null : integer(data.effort, 1, 10);
      const satisfaction = data.satisfaction === "" || data.satisfaction == null ? null : integer(data.satisfaction, 1, 10);
      const discomfort = data.discomfort === "" || data.discomfort == null ? null : integer(data.discomfort, 0, 10);
      if ((data.effort != null && data.effort !== "" && effort === null) ||
          (data.satisfaction != null && data.satisfaction !== "" && satisfaction === null) ||
          (data.discomfort != null && data.discomfort !== "" && discomfort === null)) {
        return response({ error: "Las escalas deben estar dentro del rango indicado." }, 400);
      }
      const [created] = await db.insert(checkins).values({
        id,
        ownerId,
        clientId,
        sessionDate,
        sessionType: text(data.sessionType, 80) || "Entrenamiento",
        attendance: text(data.attendance, 30) || "realizada",
        effort,
        satisfaction,
        discomfort,
        notes: text(data.notes, 1500),
        nextAction: text(data.nextAction, 500),
      }).returning();
      const dueDate = text(data.followupDate, 10);
      if (dueDate) {
        await db.insert(tasks).values({
          id: crypto.randomUUID(),
          ownerId,
          clientId,
          title: text(data.followupTitle, 150) || "Revisar seguimiento del cliente",
          dueDate,
          notes: text(data.nextAction, 500),
        });
      }
      return response({ record: created }, 201);
    }

    if (body.entity === "task") {
      const title = text(data.title, 150);
      const dueDate = text(data.dueDate, 10);
      if (!title || !dueDate) return response({ error: "La tarea necesita título y fecha." }, 400);
      const clientId = text(data.clientId, 64);
      const leadId = text(data.leadId, 64);
      if (clientId) {
        const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId))).limit(1);
        if (!client) return response({ error: "Cliente no válido." }, 400);
      }
      if (leadId) {
        const [lead] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, leadId), eq(leads.ownerId, ownerId))).limit(1);
        if (!lead) return response({ error: "Contacto no válido." }, 400);
      }
      const [created] = await db.insert(tasks).values({
        id,
        ownerId,
        clientId: clientId || null,
        leadId: leadId || null,
        title,
        dueDate,
        notes: text(data.notes, 1000),
      }).returning();
      return response({ record: created }, 201);
    }

    if (body.entity === "transaction") {
      const direction = text(data.direction, 20);
      const category = text(data.category, 80);
      const amountCents = integer(data.amountCents, 1, 100_000_000);
      const transactionDate = text(data.transactionDate, 10) || today;
      const clientId = text(data.clientId, 64);
      if (!transactionDirections.has(direction) || !category || amountCents === null) {
        return response({ error: "Revisa tipo, categoría e importe." }, 400);
      }
      if (clientId) {
        const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId))).limit(1);
        if (!client) return response({ error: "Cliente no válido." }, 400);
      }
      const paymentMethod = text(data.paymentMethod, 30);
      const [created] = await db.insert(transactions).values({
        id,
        ownerId,
        transactionDate,
        direction,
        category,
        amountCents,
        description: text(data.description, 500),
        clientId: clientId || null,
        servicePeriod: text(data.servicePeriod, 7),
        paymentMethod: paymentMethods.has(paymentMethod) ? paymentMethod : "efectivo",
        reference: text(data.reference, 100),
      }).returning();
      return response({ record: created }, 201);
    }

    return response({ error: "Tipo de registro no reconocido." }, 400);
  } catch (error) {
    console.error("CRM record creation failed", error);
    return response({ error: "No se pudo guardar el registro." }, 500);
  }
}

export async function PATCH(request: Request) {
  const ownerId = await ownerIdOrNull();
  if (!ownerId) return response({ error: "Inicia sesión para continuar." }, 401);
  try {
    const body = (await request.json()) as { entity?: string; id?: string; data?: Record<string, unknown> };
    const id = text(body.id, 64);
    const data = body.data ?? {};
    if (!id) return response({ error: "Falta el identificador del registro." }, 400);
    const db = getDb();
    const now = new Date().toISOString();

    if (body.entity === "client") {
      const name = text(data.name, 120);
      const monthlyFee = integer(data.monthlyFeeCents, 0, 100_000_000);
      const status = text(data.status, 20);
      if (!name || monthlyFee === null || !clientStatuses.has(status)) {
        return response({ error: "Revisa nombre, cuota mensual y estado." }, 400);
      }
      const [updated] = await db.update(clients).set({
        name,
        phone: text(data.phone, 40),
        email: text(data.email, 160),
        status,
        service: text(data.service, 100),
        monthlyFeeCents: monthlyFee,
        feeFrozen: data.feeFrozen === true ? 1 : 0,
        paymentMethod: paymentMethods.has(text(data.paymentMethod, 30)) ? text(data.paymentMethod, 30) : "efectivo",
        frequency: text(data.frequency, 30),
        scheduleType: text(data.scheduleType, 20) === "variable" ? "variable" : "fijo",
        trainingSchedule: text(data.trainingSchedule, 500),
        startDate: text(data.startDate, 10),
        nextReviewDate: text(data.nextReviewDate, 10),
        importantNotes: text(data.importantNotes, 500),
        goal: text(data.goal, 500),
        trainingNotes: text(data.trainingNotes, 1500),
        trainingMetrics: text(data.trainingMetrics, 2000),
        physioNotes: text(data.physioNotes, 2000),
        testimonialConsent: data.testimonialConsent === true ? 1 : 0,
        updatedAt: now,
      }).where(and(eq(clients.id, id), eq(clients.ownerId, ownerId))).returning();
      return updated ? response({ record: updated }) : response({ error: "Cliente no encontrado." }, 404);
    }

    if (body.entity === "cross_sell_offer") {
      const name = text(data.name, 120);
      const category = text(data.category, 30);
      const status = text(data.status, 20);
      const unitPriceCents = integer(data.unitPriceCents, 0, 100_000_000);
      const unitCostCents = integer(data.unitCostCents, 0, 100_000_000);
      const expectedUnits = integer(data.expectedUnits, 0, 100_000);
      const initialInvestmentCents = integer(data.initialInvestmentCents, 0, 1_000_000_000);
      if (!name || !crossSellCategories.has(category) || !crossSellStatuses.has(status) || unitPriceCents === null || unitCostCents === null || expectedUnits === null || initialInvestmentCents === null) {
        return response({ error: "Revisa el nombre, la categoría, el precio y las previsiones." }, 400);
      }
      const [updated] = await db.update(crossSellOffers).set({
        name, category, status, unitPriceCents, unitCostCents, expectedUnits,
        initialInvestmentCents, notes: text(data.notes, 1000), updatedAt: now,
      }).where(and(eq(crossSellOffers.id, id), eq(crossSellOffers.ownerId, ownerId))).returning();
      return updated ? response({ record: updated }) : response({ error: "Oferta no encontrada." }, 404);
    }

    if (body.entity === "supplement_plan") {
      const servicePeriod = text(data.servicePeriod, 7);
      const investmentCents = integer(data.investmentCents, 0, 1_000_000_000);
      if (!/^\d{4}-\d{2}$/.test(servicePeriod) || investmentCents === null) {
        return response({ error: "Indica un mes válido y una inversión mensual igual o mayor que cero." }, 400);
      }
      const [updated] = await db.update(supplementPlans).set({
        servicePeriod, investmentCents, updatedAt: now,
      }).where(and(eq(supplementPlans.id, id), eq(supplementPlans.ownerId, ownerId))).returning();
      return updated ? response({ record: updated }) : response({ error: "Plan de suplementación no encontrado." }, 404);
    }

    if (body.entity === "lead") {
      const name = text(data.name, 120);
      const stage = text(data.stage, 30);
      if (!name || !leadStages.has(stage)) return response({ error: "Revisa nombre y etapa." }, 400);
      const [updated] = await db.update(leads).set({
        name,
        contact: text(data.contact, 160),
        source: text(data.source, 100),
        objective: text(data.objective, 400),
        stage,
        nextActionDate: text(data.nextActionDate, 10),
        notes: text(data.notes, 1000),
        updatedAt: now,
      }).where(and(eq(leads.id, id), eq(leads.ownerId, ownerId))).returning();
      return updated ? response({ record: updated }) : response({ error: "Contacto no encontrado." }, 404);
    }

    if (body.entity === "task") {
      const status = text(data.status, 20);
      if (!["pendiente", "hecha"].includes(status)) return response({ error: "Estado de tarea no válido." }, 400);
      const [updated] = await db.update(tasks).set({ status })
        .where(and(eq(tasks.id, id), eq(tasks.ownerId, ownerId))).returning();
      return updated ? response({ record: updated }) : response({ error: "Tarea no encontrada." }, 404);
    }

    if (body.entity === "transaction") {
      if (typeof data.reconciled !== "boolean") {
        return response({ error: "Indica si el movimiento está conciliado." }, 400);
      }
      const [updated] = await db.update(transactions).set({ reconciled: data.reconciled ? 1 : 0 })
        .where(and(eq(transactions.id, id), eq(transactions.ownerId, ownerId))).returning();
      return updated ? response({ record: updated }) : response({ error: "Movimiento no encontrado." }, 404);
    }

    return response({ error: "Tipo de actualización no reconocido." }, 400);
  } catch (error) {
    console.error("CRM record update failed", error);
    return response({ error: "No se pudo actualizar el registro." }, 500);
  }
}
