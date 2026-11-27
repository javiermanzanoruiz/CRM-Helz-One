import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    status: text("status").notNull().default("active"),
    service: text("service").notNull().default(""),
    monthlyFeeCents: integer("monthly_fee_cents").notNull().default(0),
    feeFrozen: integer("fee_frozen").notNull().default(0),
    paymentDay: integer("payment_day").notNull().default(5),
    paymentMethod: text("payment_method").notNull().default("transferencia"),
    frequency: text("frequency").notNull().default(""),
    scheduleType: text("schedule_type").notNull().default("fijo"),
    trainingSchedule: text("training_schedule").notNull().default(""),
    startDate: text("start_date").notNull().default(""),
    nextReviewDate: text("next_review_date").notNull().default(""),
    importantNotes: text("important_notes").notNull().default(""),
    goal: text("goal").notNull().default(""),
    trainingNotes: text("training_notes").notNull().default(""),
    trainingMetrics: text("training_metrics").notNull().default(""),
    physioNotes: text("physio_notes").notNull().default(""),
    testimonialConsent: integer("testimonial_consent").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("clients_owner_status_idx").on(table.ownerId, table.status),
    index("clients_owner_name_idx").on(table.ownerId, table.name),
  ],
);

export const monthlyDues = sqliteTable(
  "monthly_dues",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    clientId: text("client_id").notNull(),
    servicePeriod: text("service_period").notNull(),
    amountDueCents: integer("amount_due_cents").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("monthly_dues_owner_client_period_uq").on(
      table.ownerId,
      table.clientId,
      table.servicePeriod,
    ),
    index("monthly_dues_owner_period_idx").on(
      table.ownerId,
      table.servicePeriod,
    ),
  ],
);

export const crossSellOffers = sqliteTable(
  "cross_sell_offers",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("otro"),
    status: text("status").notNull().default("planificada"),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    expectedUnits: integer("expected_units").notNull().default(0),
    initialInvestmentCents: integer("initial_investment_cents").notNull().default(0),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("cross_sell_offers_owner_status_idx").on(table.ownerId, table.status),
  ],
);

export const supplementPlans = sqliteTable(
  "supplement_plans",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    servicePeriod: text("service_period").notNull(),
    investmentCents: integer("investment_cents").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("supplement_plans_owner_period_uq").on(table.ownerId, table.servicePeriod),
  ],
);

export const tanitaAssessments = sqliteTable(
  "tanita_assessments",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    clientId: text("client_id").notNull(),
    assessmentDate: text("assessment_date").notNull(),
    weightKg: real("weight_kg"),
    bodyFatPercent: real("body_fat_percent"),
    muscleMassKg: real("muscle_mass_kg"),
    visceralFat: integer("visceral_fat"),
    bmi: real("bmi"),
    basalMetabolismKcal: integer("basal_metabolism_kcal"),
    bodyWaterPercent: real("body_water_percent"),
    priceCents: integer("price_cents").notNull().default(2000),
    paid: integer("paid").notNull().default(0),
    paymentMethod: text("payment_method").notNull().default("efectivo"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("tanita_assessments_owner_client_date_idx").on(
      table.ownerId,
      table.clientId,
      table.assessmentDate,
    ),
  ],
);

export const professionalNotes = sqliteTable(
  "professional_notes",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    clientId: text("client_id").notNull(),
    professionalRole: text("professional_role").notNull(),
    note: text("note").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("professional_notes_owner_client_role_date_idx").on(
      table.ownerId,
      table.clientId,
      table.professionalRole,
      table.createdAt,
    ),
  ],
);

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    contact: text("contact").notNull().default(""),
    source: text("source").notNull().default(""),
    objective: text("objective").notNull().default(""),
    stage: text("stage").notNull().default("nuevo"),
    nextActionDate: text("next_action_date").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("leads_owner_stage_idx").on(table.ownerId, table.stage),
    index("leads_owner_action_idx").on(table.ownerId, table.nextActionDate),
  ],
);

export const checkins = sqliteTable(
  "checkins",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    clientId: text("client_id").notNull(),
    sessionDate: text("session_date").notNull(),
    sessionType: text("session_type").notNull().default("Entrenamiento"),
    attendance: text("attendance").notNull().default("realizada"),
    effort: integer("effort"),
    satisfaction: integer("satisfaction"),
    discomfort: integer("discomfort"),
    notes: text("notes").notNull().default(""),
    nextAction: text("next_action").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("checkins_owner_client_date_idx").on(
      table.ownerId,
      table.clientId,
      table.sessionDate,
    ),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    clientId: text("client_id"),
    leadId: text("lead_id"),
    title: text("title").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull().default("pendiente"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("tasks_owner_status_due_idx").on(
      table.ownerId,
      table.status,
      table.dueDate,
    ),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    transactionDate: text("transaction_date").notNull(),
    direction: text("direction").notNull(),
    category: text("category").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull().default(""),
    clientId: text("client_id"),
    servicePeriod: text("service_period").notNull().default(""),
    paymentMethod: text("payment_method").notNull().default(""),
    reference: text("reference").notNull().default(""),
    reconciled: integer("reconciled").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("transactions_owner_date_idx").on(
      table.ownerId,
      table.transactionDate,
    ),
    index("transactions_owner_period_idx").on(
      table.ownerId,
      table.servicePeriod,
      table.direction,
    ),
  ],
);
