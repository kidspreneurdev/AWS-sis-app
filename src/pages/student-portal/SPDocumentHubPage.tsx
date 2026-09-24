import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, ClipboardCheck, BookOpen, type LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudentPortal } from '@/contexts/StudentPortalContext'
import { card, SP_NAVY } from './gradesShared'
import { SPDocumentsPage } from './SPDocumentsPage'
import { SPOnboardingPage } from './SPOnboardingPage'
import { SPStudentRecordsPage } from './SPStudentRecordsPage'
import {
  HUB_STATUS_META, REQUIRED_DOCS, mapDocumentStatus, mapRecordStatus, mapOnboardingStatus,
  type HubStatus,
} from './docHubShared'
import {
  RECORD_CATEGORIES, recordDefsForCategory, recordSupportsSignedReturn, isRecordAvailable,
  type RecordView, type SignedReturnStatus,
} from '@/types/studentRecord'

const TABS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'enrollment', label: 'Enrollment docs', icon: FileText },
  { key: 'assessments', label: 'Onboarding Assessments', icon: ClipboardCheck },
  { key: 'course', label: 'Course docs', icon: BookOpen },
]
const TAB_KEYS = TABS.map((t) => t.key)

async function authedFetch(token: string, url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Request failed.')
  return body
}

export function SPDocumentHubPage() {
  const { session, getToken } = useStudentPortal()

  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') ?? ''
  const [tab, setTab] = useState(TAB_KEYS.includes(requestedTab) ? requestedTab : 'enrollment')

  function selectTab(key: string) {
    setTab(key)
    setSearchParams({ tab: key }, { replace: true })
  }

  const [summary, setSummary] = useState<{ actionNeeded: number; awaitingSchool: number; complete: number } | null>(null)

  useEffect(() => {
    if (!session) return
    const studentDbId = session.dbId
    const token = getToken()

    async function loadSummary() {
      let actionNeeded = 0
      let awaitingSchool = 0
      let complete = 0
      function bump(status: HubStatus) {
        if (status === 'Action needed') actionNeeded += 1
        else if (status === 'Awaiting school') awaitingSchool += 1
        else complete += 1
      }

      await Promise.all([
        // Enrollment documents (student_documents has no upload UI / no API route — same direct read SPDocumentsPage uses)
        (async () => {
          try {
            const { data } = await supabase.from('student_documents').select('document_name,status').eq('student_id', studentDbId)
            const byName = Object.fromEntries(((data as Record<string, unknown>[] | null) ?? []).map((r) => [r.document_name as string, r.status as string]))
            REQUIRED_DOCS.forEach((name) => bump(mapDocumentStatus(byName[name] ?? 'Missing')))
          } catch { /* soft-fail: leave this source out of the summary rather than show a raw error */ }
        })(),

        // Onboarding checklist
        (async () => {
          try {
            if (token) {
              const body = await authedFetch(token, '/api/student-portal/list-my-onboarding')
              for (const s of body.steps ?? []) bump(mapOnboardingStatus(!!s.completed))
            } else {
              const { data } = await supabase.from('student_onboarding').select('completed').eq('student_id', studentDbId)
              const rows = (data as Record<string, unknown>[] | null) ?? []
              rows.forEach((r) => bump(mapOnboardingStatus(!!r.completed)))
            }
          } catch { /* soft-fail */ }
        })(),

        // Records (Assessments + Course docs tabs combined)
        (async () => {
          try {
            let rows: RecordView[] = []
            if (token) {
              const body = await authedFetch(token, '/api/student-portal/list-my-records')
              rows = (body.records ?? []).map((r: Record<string, unknown>) => ({
                recordType: r.recordType,
                source: (r.source as 'upload' | 'generated') ?? 'upload',
                hasFile: !!r.hasFile,
                fileName: null, fileSize: null, uploadedAt: null,
                generatedAt: null,
                data: (r.data as Record<string, unknown> | null) ?? null,
                signedFileUrl: null, signedFileName: null,
                signedStatus: (r.signedStatus as SignedReturnStatus | null) ?? null,
                signedReviewNote: null,
              })) as RecordView[]
            } else {
              const { data } = await supabase
                .from('student_records')
                .select('record_type,source,storage_path,data,signed_status')
                .eq('student_id', studentDbId)
              rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
                recordType: r.record_type,
                source: (r.source as 'upload' | 'generated') ?? 'upload',
                hasFile: !!r.storage_path,
                fileName: null, fileSize: null, uploadedAt: null,
                generatedAt: null,
                data: (r.data as Record<string, unknown> | null) ?? null,
                signedFileUrl: null, signedFileName: null,
                signedStatus: (r.signed_status as SignedReturnStatus | null) ?? null,
                signedReviewNote: null,
              })) as unknown as RecordView[]
            }
            const byType: Record<string, RecordView> = {}
            rows.forEach((r) => { byType[r.recordType as unknown as string] = r })
            RECORD_CATEGORIES.forEach((cat) => {
              recordDefsForCategory(cat.key).forEach((def) => {
                const rec = byType[def.type]
                const available = isRecordAvailable(rec, def)
                const needsSig = available && recordSupportsSignedReturn(def.type)
                bump(mapRecordStatus(available, rec?.signedStatus ?? null, needsSig))
              })
            })
          } catch { /* soft-fail */ }
        })(),
      ])

      setSummary({ actionNeeded, awaitingSchool, complete })
    }

    void loadSummary()
  }, [session, getToken])

  if (!session) return null

  const total = summary ? summary.actionNeeded + summary.awaitingSchool + summary.complete : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: SP_NAVY, margin: 0 }}>Enrollment & Documents</h1>
        <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>Everything you need to submit, sign, or track — in one place</p>
      </div>

      {summary && total > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {([
            { label: 'Action needed' as const, count: summary.actionNeeded },
            { label: 'Awaiting school' as const, count: summary.awaitingSchool },
            { label: 'Complete' as const, count: summary.complete },
          ]).map((s) => (
            <div key={s.label} style={{ ...card, flex: '1 1 140px', padding: '14px 16px', borderLeft: `4px solid ${HUB_STATUS_META[s.label].fg}` }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: HUB_STATUS_META[s.label].fg }}>{s.count}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: SP_NAVY, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, border: '1.5px solid #E4EAF2', borderRadius: 10, overflow: 'hidden' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            style={{
              flex: 1, padding: 10, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Poppins,sans-serif',
              background: tab === t.key ? SP_NAVY : '#F7F9FC',
              color: tab === t.key ? '#fff' : '#7A92B0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'enrollment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SPDocumentsPage />
          <div style={{ borderTop: '1px solid #E4EAF2' }} />
          <SPOnboardingPage />
        </div>
      )}
      {tab === 'assessments' && <SPStudentRecordsPage categoryFilter={['diagnostics', 'psychometric']} />}
      {tab === 'course' && <SPStudentRecordsPage categoryFilter={['learning_resources', 'course']} />}
    </div>
  )
}
