declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CRM_ACCESS_PIN?: string;
    CRM_SESSION_SECRET?: string;
  }
}
