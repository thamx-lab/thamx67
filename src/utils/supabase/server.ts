import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  let cookieStore: any = null
  try {
    cookieStore = await cookies()
  } catch (err) {
    // Graceful fallback if called outside active request scope during static collection
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name: string) {
          return cookieStore ? cookieStore.get(name)?.value : undefined
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            if (cookieStore) cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignore cookie setting errors inside server component rendering context
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            if (cookieStore) cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignore cookie removal errors inside server component rendering context
          }
        },
      },
    }
  )
}
