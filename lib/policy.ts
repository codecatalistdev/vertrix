import type { Role } from './types'

export function canManageInterview(role: Role) {
  return role === 'admin' || role === 'supporter'
}

export function canViewInterview(
  user: { id: string; role: Role },
  interview: { interviewerId: string },
) {
  if (user.role === 'admin' || user.role === 'supporter') return true
  return user.role === 'proxy' && user.id === interview.interviewerId
}
