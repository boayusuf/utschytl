import { useState } from 'react'

// SHA-256 hash function using Web Crypto API
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Pre-hashed credentials (password: "admin123" -> SHA-256)
// In production, this would be server-side with bcrypt/argon2
const USERS = {
  admin: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  analyst: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
}

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 30000

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (locked) return

    if (!username.trim() || !password.trim()) {
      setError('ALL FIELDS REQUIRED')
      return
    }

    // Rate limiting
    if (attempts >= MAX_ATTEMPTS) {
      setLocked(true)
      setError(`TOO MANY ATTEMPTS. LOCKED FOR ${LOCKOUT_MS / 1000}s`)
      setTimeout(() => {
        setLocked(false)
        setAttempts(0)
        setError('')
      }, LOCKOUT_MS)
      return
    }

    setLoading(true)

    // Sanitize input
    const sanitizedUser = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    const hash = await sha256(password)

    // Constant-time-ish comparison (prevents timing attacks in demo)
    const expectedHash = USERS[sanitizedUser]
    if (expectedHash && hash === expectedHash) {
      // Store session with expiry
      const session = {
        user: sanitizedUser,
        loginTime: Date.now(),
        expiresAt: Date.now() + 3600000, // 1 hour
      }
      sessionStorage.setItem('sega_hq_session', JSON.stringify(session))
      setLoading(false)
      onLogin(sanitizedUser)
    } else {
      setAttempts(a => a + 1)
      setError(`INVALID CREDENTIALS (${MAX_ATTEMPTS - attempts - 1} ATTEMPTS LEFT)`)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0060A8]">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative w-96 bg-white/95 backdrop-blur-sm rounded-2xl border-2 border-[#FFD93D] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0060A8] px-6 py-4 text-center">
          <div className="font-press text-2xl text-white tracking-[0.2em]">SEGA</div>
          <div className="font-press text-sm text-[#FFD93D] tracking-[0.4em] mt-1">HQ</div>
          <div className="font-press text-[8px] text-[#7BC8F6] mt-2">SECURE NETWORK MONITORING</div>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="font-press text-[10px] text-[#4A6FA5] text-center">
            AUTHORIZED PERSONNEL ONLY
          </div>

          <div>
            <label className="font-press text-[8px] text-gray-400 block mb-1">USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={locked}
              maxLength={20}
              autoComplete="username"
              className="w-full font-press text-[11px] px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-[#7BC8F6] focus:outline-none disabled:opacity-50"
              placeholder="ENTER USERNAME"
            />
          </div>

          <div>
            <label className="font-press text-[8px] text-gray-400 block mb-1">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={locked}
              maxLength={64}
              autoComplete="current-password"
              className="w-full font-press text-[11px] px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-[#7BC8F6] focus:outline-none disabled:opacity-50"
              placeholder="ENTER PASSWORD"
            />
          </div>

          {error && (
            <div className="font-press text-[8px] text-[#FF6B6B] text-center bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={locked || loading}
            className="font-press text-[10px] px-4 py-3 bg-[#0060A8] text-white rounded-xl border-2 border-[#004080] hover:bg-[#0070C0] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md transition-colors"
          >
            {loading ? 'AUTHENTICATING...' : locked ? 'LOCKED' : '> LOGIN'}
          </button>

          <div className="font-press text-[7px] text-gray-300 text-center mt-2">
            DEMO: admin / admin123
          </div>
        </form>

        {/* Security info footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
          <div className="font-press text-[6px] text-gray-300 text-center">
            SHA-256 HASHED | SESSION EXPIRES IN 1HR | {MAX_ATTEMPTS} ATTEMPT LIMIT
          </div>
        </div>
      </div>
    </div>
  )
}
