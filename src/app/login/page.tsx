import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default function Login({
  searchParams,
}: {
  searchParams: { message: string }
}) {
  const signIn = async (formData: FormData) => {
    'use server'

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return redirect('/login?message=Could not authenticate user')
    }

    return redirect('/')
  }

  const signUp = async (formData: FormData) => {
    'use server'

    const origin = (await headers()).get('origin')
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })

    if (error) {
      return redirect('/login?message=Could not authenticate user')
    }

    return redirect('/login?message=Check email to continue sign in process')
  }

  return (
    <div className="container" style={{ maxWidth: '400px', marginTop: '10vh' }}>
      <h2 className="main-title" style={{ textAlign: 'center' }}>Welcome Back</h2>
      <p className="sub" style={{ textAlign: 'center' }}>Sign in to use the Label Cropper</p>
      
      <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="field-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
          />
        </div>
        <div className="field-row" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button formAction={signIn} className="btn primary" style={{ flex: 1 }}>
            Sign In
          </button>
          <button formAction={signUp} className="btn" style={{ flex: 1 }}>
            Sign Up
          </button>
        </div>
        
        {searchParams?.message && (
          <p style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-accent)', color: 'var(--border-accent)', borderRadius: '8px', textAlign: 'center', fontSize: '14px' }}>
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
