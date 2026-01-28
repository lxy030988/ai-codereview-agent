import jwt from 'jsonwebtoken'

// Generate Authorization headers for Mastra API calls.
export function requireAuthHeaders() {
  const token = process.env.MASTRA_JWT_TOKEN || signWithSecret()

  if (!token) {
    throw new Error('缺少 JWT token，请设置 MASTRA_JWT_TOKEN 或 JWT_AUTH_SECRET')
  }

  return { Authorization: `Bearer ${token}` }
}

function signWithSecret() {
  const secret = process.env.JWT_AUTH_SECRET
  if (!secret) return null

  return jwt.sign(
    {
      sub: 'ai-codereview-cli',
      role: 'cli',
      iat: Math.floor(Date.now() / 1000)
    },
    secret,
    {
      expiresIn: '1h',
      issuer: 'ai-codereview-agent'
    }
  )
}
