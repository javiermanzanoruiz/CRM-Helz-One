declare namespace Cloudflare {
  interface Env {
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    CRM_ACCESS_USERS?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
