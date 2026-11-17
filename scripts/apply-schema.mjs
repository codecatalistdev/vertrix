import { readFile } from 'fs/promises'

const envText = await readFile(new URL('../.env.local', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }),
)

const url = env.SUPABASE_URL.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
const key = env.SUPABASE_SECRET_KEY
const ref = new URL(url).hostname.split('.')[0]
const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}

const probe = await fetch(`${url}/rest/v1/users?select=id&limit=1`, { headers })
const probeBody = await probe.text()
console.log(`rest users: ${probe.status} ${probeBody.slice(0, 240)}`)

if (probe.ok) {
  console.log('tables already reachable')
} else {
  const attempts = [
    [`https://api.supabase.com/v1/projects/${ref}/database/query`, { query: sql }],
    [`https://api.supabase.com/v1/projects/${ref}/database/migrations`, { query: sql, name: 'Vertrix_init' }],
  ]
  for (const [endpoint, body] of attempts) {
    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await response.text()
    console.log(`${endpoint}: ${response.status} ${text.slice(0, 400)}`)
  }
}

const bucket = await fetch(`${url}/storage/v1/bucket`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ id: 'resumes', name: 'resumes', public: false, file_size_limit: 8388608 }),
})
const bucketBody = await bucket.text()
console.log(`bucket: ${bucket.status} ${bucketBody.slice(0, 240)}`)
