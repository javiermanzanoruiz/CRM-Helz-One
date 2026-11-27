"use client";

import { readApiResponse } from "../../lib/api-response";

import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "fisioterapia" | "podologia";
type Client = { id: string; name: string; status: string; service: string; frequency: string; scheduleType: string; trainingSchedule: string; importantNotes: string; goal: string; trainingNotes: string; trainingMetrics: string; legacyProfessionalNotes: string };
type Note = { id: string; clientId: string; note: string; createdAt: string };
type Dataset = { role: Role; clients: Client[]; notes: Note[] };
const labels: Record<Role,string> = { fisioterapia: "Fisioterapia", podologia: "Podología" };
const noteDateFormat = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

function todayLabel(value: string) {
  if (!value) return "Fecha no disponible";
  // SQLite CURRENT_TIMESTAMP returns UTC without a timezone suffix.
  const timestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(" ", "T") + "Z"
    : value;
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? noteDateFormat.format(date) : "Fecha no disponible";
}

export function ProfessionalLogin() {
  const [role, setRole] = useState<Role>("fisioterapia");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/professional-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, code }) });
      await readApiResponse(response, "No se pudo validar el acceso.");
      window.location.replace(`/profesionales?entrada=${Date.now()}`);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo validar el acceso."); }
    finally { setBusy(false); }
  }
  return <main className="professional-login"><form className="professional-login-card" onSubmit={login}>
    <div className="pro-brand-mark">H</div><div className="pro-eyebrow">HELZ-ONE · ÁREA PROFESIONAL</div>
    <h1>Fichas de clientes</h1><p>Acceso restringido para profesionales del centro.</p>
    <label>Área profesional<select value={role} onChange={e=>setRole(e.target.value as Role)}><option value="fisioterapia">Fisioterapia</option><option value="podologia">Podología</option></select></label>
    <label>Código de acceso<input type="password" value={code} onChange={e=>setCode(e.target.value)} autoComplete="current-password" required maxLength={100} /></label>
    {error&&<div className="pro-error">{error}</div>}
    <button className="pro-button pro-button-primary" disabled={busy}>{busy?"Validando…":"Entrar al área profesional"}</button>
    <small>Este acceso no muestra cuotas, cobros ni información económica.</small>
  </form></main>;
}

export function ProfessionalPortal({ role }: { role: Role }) {
  const [data, setData] = useState<Dataset|null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback((signal?:AbortSignal) => fetch("/api/professional", { cache: "no-store", signal })
    .then(response=>readApiResponse<Dataset>(response,"No se pudieron cargar las fichas."))
    .then(result=>{if(!signal?.aborted){setData(result);setError("");}})
    .catch((e:unknown)=>{if(!signal?.aborted)setError(e instanceof Error?e.message:"No se pudieron cargar las fichas.");}), []);
  useEffect(() => { const controller=new AbortController();void load(controller.signal);return ()=>controller.abort(); }, [load]);
  const filtered = useMemo(() => (data?.clients||[]).filter(c => `${c.name} ${c.service} ${c.importantNotes}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))), [data, search]);
  const selected = data?.clients.find(c=>c.id===selectedId) || filtered[0] || null;
  const notes = (data?.notes||[]).filter(n=>n.clientId===selected?.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  async function addNote(event: React.FormEvent) {
    event.preventDefault(); if(!selected||!draft.trim())return;
    setBusy(true);setError("");setNotice("");
    try {
      const response = await fetch("/api/professional", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: selected.id, note: draft }) });
      await readApiResponse(response, "No se pudo guardar la anotación.");
      setDraft("");setNotice("Anotación guardada en el historial de la ficha.");await load();
    } catch(e) { setError(e instanceof Error?e.message:"No se pudo guardar la anotación."); }
    finally { setBusy(false); }
  }
  async function logout() {
    setError(""); setNotice(""); setBusy(true);
    try {
      const response = await fetch("/api/professional-access", { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo cerrar la sesión profesional.");
      window.location.replace("/profesionales");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cerrar la sesión profesional."); setBusy(false); }
  }
  return <main className="professional-app">
    <header className="professional-topbar"><div className="professional-brand"><span className="pro-brand-mark small">H</span><div><strong>HELZ-ONE</strong><small>FICHAS PROFESIONALES</small></div></div><div className="professional-account"><span>{labels[role]}</span><button onClick={()=>void logout()}>Cerrar sesión</button></div></header>
    <div className="professional-layout">
      <aside className="professional-list"><div className="pro-list-heading"><span className="pro-eyebrow">CLIENTES</span><strong>{data?filtered.length:"…"}</strong></div><input className="pro-search" placeholder="Buscar cliente…" value={search} onChange={e=>setSearch(e.target.value)}/>
        {filtered.map(client=><button key={client.id} className={`pro-client-item ${client.id===selected?.id?"selected":""}`} onClick={()=>setSelectedId(client.id)}><strong>{client.name}</strong><small>{client.service||"Servicio por definir"}</small><span className={`pro-status ${client.status}`}>{client.status==="active"?"Activo":client.status==="paused"?"En pausa":"Antiguo"}</span></button>)}
        {data&&!filtered.length&&<p className="pro-empty">{search?"No hay coincidencias.":"Todavía no hay clientes en el CRM."}</p>}
      </aside>
      <section className="professional-record">
        {error&&<div className="pro-error">{error}</div>}{notice&&<div className="pro-success">{notice}</div>}
        {!selected?<div className="pro-empty-panel"><span>H</span><h1>Ficha profesional</h1><p>Selecciona un cliente para consultar la información clínica y registrar anotaciones.</p></div>:<>
          <div className="pro-record-heading"><div><div className="pro-eyebrow">FICHA · {labels[role].toLocaleUpperCase("es")}</div><h1>{selected.name}</h1><p>{selected.service||"Servicio por definir"} · {selected.status==="active"?"Activo":selected.status==="paused"?"En pausa":"Antiguo"}</p></div><span className="pro-status large">{selected.status==="active"?"Activo":selected.status==="paused"?"En pausa":"Antiguo"}</span></div>
          <div className="pro-info-grid">
            <article className="pro-info-card"><span>Horario</span><strong>{selected.scheduleType==="variable"?"Variable · ":"Fijo · "}{selected.trainingSchedule||"Por definir"}</strong></article>
            <article className="pro-info-card"><span>Frecuencia</span><strong>{selected.frequency?`${selected.frequency} ${selected.frequency==="1"?"día":"días"} / semana`:"Por definir"}</strong></article>
            <article className="pro-info-card"><span>Objetivo principal</span><strong>{selected.goal||"Por definir"}</strong></article>
            <article className="pro-info-card"><span>Notas importantes</span><strong>{selected.importantNotes||"Sin notas importantes registradas"}</strong></article>
            <article className="pro-info-card"><span>Notas de entrenamiento</span><strong>{selected.trainingNotes||"Sin notas de entrenamiento"}</strong></article>
            <article className="pro-info-card"><span>Retos y métricas</span><strong>{selected.trainingMetrics||"Sin métricas registradas"}</strong></article>
            {role==="fisioterapia"&&selected.legacyProfessionalNotes&&<article className="pro-info-card"><span>Anotaciones previas de fisioterapia</span><strong>{selected.legacyProfessionalNotes}</strong></article>}
          </div>
          <section className="pro-notes-section"><div className="pro-section-heading"><div><h2>Historial de anotaciones</h2><p>Registro de {labels[role].toLocaleLowerCase("es")} · las notas quedan fechadas.</p></div><span>{notes.length}</span></div>
            {notes.length?<div className="pro-note-list">{notes.map(note=><article className="pro-note" key={note.id}><time>{todayLabel(note.createdAt)}</time><p>{note.note}</p></article>)}</div>:<div className="pro-no-notes">Todavía no hay anotaciones de {labels[role].toLocaleLowerCase("es")} para este cliente.</div>}
            <form className="pro-note-form" onSubmit={addNote}><label htmlFor="pro-note">Añadir anotación</label><textarea id="pro-note" rows={5} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={3000} placeholder="Escribe la valoración, evolución, intervención o pautas acordadas…"/><div className="pro-note-footer"><small>{draft.length} / 3000</small><button className="pro-button pro-button-primary" disabled={busy||!draft.trim()}>{busy?"Guardando…":"Guardar anotación"}</button></div></form>
          </section>
        </>}
      </section>
    </div>
  </main>;
}
