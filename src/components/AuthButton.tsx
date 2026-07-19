import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function AuthButton() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const signOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    return redirect('/login')
  }

  return user ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
        Hey, {user.email}!
      </span>
      <form action={signOut}>
        <button className="btn" style={{ padding: '6px 12px', fontSize: '12px' }}>
          Logout
        </button>
      </form>
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '16px', borderBottom: '1px solid var(--border)' }}>
      <a href="/login" className="btn primary" style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}>
        Login
      </a>
    </div>
  )
}
