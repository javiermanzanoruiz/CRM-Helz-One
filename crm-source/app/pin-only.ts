import { env } from "cloudflare:workers";

const settings = env as unknown as Record<string, string | undefined>;

export function pinOnlyEnabled() {
  return settings.CRM_AUTH_MODE === "pin-only";
}

export function pinOnlyOwnerId() {
  return settings.CRM_DATA_OWNER_ID?.trim() || null;
}

export function pinOnlyReady() {
  const pins = [settings.CRM_ACCESS_PIN, settings.CRM_PHYSIO_PIN, settings.CRM_PODOLOGY_PIN];
  return Boolean(pinOnlyOwnerId() && (settings.CRM_SESSION_SECRET?.length ?? 0) >= 32 &&
    pins.every(pin => pin && /^\d{8,32}$/.test(pin)) && new Set(pins).size === pins.length);
}
