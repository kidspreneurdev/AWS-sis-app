// Notifications module — admin composes a message (subject/content/attachments) and
// sends it to specific students, a grade, a cohort, or all enrolled students.
// Recipients are resolved and snapshotted into notification_recipients at send time.

export type AudienceType = 'students' | 'grade' | 'cohort' | 'all'

export interface NotificationAttachment {
  url: string
  name: string
}

export interface Notification {
  id: string
  subject: string
  content: string
  attachments: NotificationAttachment[]
  audienceType: AudienceType
  audienceLabel: string
  sentAt: string
  recipientCount: number
  readCount: number
}
