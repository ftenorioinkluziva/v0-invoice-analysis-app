import { betterAuth } from 'better-auth'
import { Pool } from '@neondatabase/serverless'

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({ connectionString: process.env.DATABASE_URL! }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
})
