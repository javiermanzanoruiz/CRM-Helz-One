"use client";

import { useState } from "react";

export function PinEntry() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }), cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo abrir el CRM.");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir el CRM.");
      setPin("");
    } finally { setBusy(false); }
  }

  return <main className="pin-page"><form className="pin-card" onSubmit={submit}>
    <div className="brand-mark pin-mark">H</div>
    <div className="eyebrow">HELZ-ONE · PERSONAL TRAINING</div>
    <h1>Tu centro, bajo control.</h1>
    <p>Introduce tu PIN para abrir el CRM de Helz-One.</p>
    <label className="pin-label" htmlFor="crm-pin">PIN de acceso</label>
    <input id="crm-pin" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]*" maxLength={8} required autoFocus value={pin} onChange={event=>setPin(event.target.value)} aria-label="PIN de acceso" />
    {error && <div className="notice notice-error">{error}</div>}
    <button className="button button-primary pin-submit" disabled={busy}>{busy?"Validando…":"Entrar al CRM"}</button>
    <small>Acceso privado · Helz-One Morón de la Frontera</small>
  </form></main>;
}
