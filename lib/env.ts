import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(8),
  N8N_WEBHOOK_SECRET: z.string().min(8),
  WAHA_API_KEY: z.string().min(8),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success && process.env.NODE_ENV === 'production') {
  console.error('[Mellyna] ❌ Missing required environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.success ? parsed.data : ({} as z.infer<typeof envSchema>)
