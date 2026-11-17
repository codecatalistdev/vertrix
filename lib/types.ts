export type Role = 'admin' | 'proxy' | 'supporter'

export type Status = 'scheduled' | 'waiting' | 'passed' | 'hold' | 'failed' | 'offer'

export type StepId = 'intro' | 'tech' | 'final' | 'offer'

export type StepResults = Partial<Record<StepId, Status>>

export type PublicUser = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
}

export type UserRecord = PublicUser & {
  passwordHash: string
}

export type ResumeRecord = {
  originalName: string
  storedName: string
  mime: string
  size: number
}

export type ResumeView = {
  originalName: string
  size: number
}

export type Interview = {
  id: string
  title: string
  candidateName: string
  status: Status
  color: string
  interviewerId: string
  createdById: string
  date: string
  startMinutes: number
  durationMinutes: number
  step: string
  stepResults: StepResults
  realMeetingLink: string
  supportMeetingLink: string
  jdLink: string
  docLink: string
  note: string
  resume: ResumeRecord | null
  createdAt: string
  updatedAt: string
}

export type InterviewView = Omit<Interview, 'resume'> & {
  resume: ResumeView | null
  interviewerName: string
  interviewerEmail: string | null
  createdByName: string
}

export type ChatMessage = {
  id: string
  interviewId: string
  userId: string
  userName: string
  userRole: Role
  body: string
  createdAt: string
}

export type Person = {
  id: string
  name: string
  email: string
  role: Role
}

export type Database = {
  users: UserRecord[]
  interviews: Interview[]
  messages: ChatMessage[]
}
