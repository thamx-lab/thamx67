import { createClient } from '@/utils/supabase/server'
import { signOutAction } from '@/app/actions/auth'

export default async function AuthButton() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return user ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '13px', color: '#94a3b8' }}>
        👤 {user.email}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '6px',
            background: '#334155',
            color: '#f8fafc',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </form>
    </div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <a
        href="/login"
        style={{
          padding: '6px 16px',
          fontSize: '12px',
          fontWeight: 700,
          borderRadius: '6px',
          background: '#6366f1',
          color: '#fff',
          textDecoration: 'none'
        }}
      >
        Login
      </a>
    </div>
  )
}
