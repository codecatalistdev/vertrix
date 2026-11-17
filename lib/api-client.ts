export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(url, { ...init, headers })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login'
    throw new Error('Sign in required.')
  }
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data as T
}
