import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { downloadUrl } from '@/lib/uploadFile'
import { PdfPagedViewer } from '@/components/pdf/PdfViewer'

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}

interface CalendarInfo {
  academicYear: string
  fileUrl: string
  fileName: string | null
}

export function SPAcademicCalendarPage() {
  const [calendar, setCalendar] = useState<CalendarInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('academic_calendars')
      .select('academic_year,file_url,file_name,is_current,uploaded_at')
      .order('is_current', { ascending: false })
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .then(({ data, error: dbError }) => {
        if (cancelled) return
        if (dbError) { setError('Could not load the academic calendar.'); setLoading(false); return }
        const row = (data ?? [])[0]
        setCalendar(row ? {
          academicYear: (row.academic_year as string) ?? '',
          fileUrl: (row.file_url as string) ?? '',
          fileName: (row.file_name as string | null) ?? null,
        } : null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A365E', margin: 0 }}>Academic Calendar</h1>
          <p style={{ fontSize: 13, color: '#7A92B0', margin: '4px 0 0' }}>
            {calendar ? `School year ${calendar.academicYear}` : 'The school’s annual academic calendar'}
          </p>
        </div>
        {calendar && (
          <button
            onClick={() => void downloadUrl(calendar.fileUrl, calendar.fileName || `Academic Calendar ${calendar.academicYear}.pdf`)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Download PDF
          </button>
        )}
      </div>

      {error && (
        <div style={{ ...card, background: '#FFF8F8', border: '1px solid #F5C2C7', color: '#991B1B', fontSize: 13 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : !calendar ? (
        <div style={{ ...card, textAlign: 'center', color: '#7A92B0', fontSize: 13 }}>
          The academic calendar has not been published yet. Please check back later.
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden', flex: 1, minHeight: 480, display: 'flex' }}>
          <PdfPagedViewer url={calendar.fileUrl} />
        </div>
      )}
    </div>
  )
}
