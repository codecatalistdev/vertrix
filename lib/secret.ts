const minimumLength = 32

export function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim() ?? ''
  if (secret.length < minimumLength) return null
  return secret
}
