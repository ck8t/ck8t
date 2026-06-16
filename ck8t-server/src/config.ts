/** Centralised config — reads env vars with sane defaults. */
export const config = {
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || '0.0.0.0',

  /** LLM API keys — set at least one to use the server. */
  openaiKey: process.env.OPENAI_API_KEY || '',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',

  /** Postgres connection string — optional, falls back to file storage. */
  databaseUrl: process.env.DATABASE_URL || '',

  /**
   * In-process cron scheduler (setInterval-based).
   * Disabled by default — not safe for multi-replica deployments.
   * Set USE_IN_PROCESS_CRON=true only for single-instance / local dev.
   */
  useInProcessCron: process.env.USE_IN_PROCESS_CRON === 'true',
}
