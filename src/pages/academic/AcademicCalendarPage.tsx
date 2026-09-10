import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { uploadFile, downloadUrl } from '@/lib/uploadFile'
import { useHeaderActions, topbarBtn } from '@/contexts/PageHeaderContext'
import { PdfPagedViewer } from '@/components/pdf/PdfViewer'

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #E4EAF2',
  boxShadow: '0 1px 4px rgba(26,54,94,0.06)', padding: 20,
}

function btn(bg: string, color = '#fff'): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 8,
    border: bg === '#fff' ? '1px solid #E4EAF2' : 'none',
    background: bg, color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalendarRow {
  id: string
  academicYear: string
  fileUrl: string
  fileName: string | null
  fileSize: number | null
  isCurrent: boolean
  uploadedAt: string | null
}

function toDbErrorMessage(error: unknown) {
  const msg = (error as { message?: string } | null)?.message ?? 'Unknown database error'
  if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('academic_calendars')) {
    return 'Table "academic_calendars" not found. Run the academic-calendars migration first.'
  }
  return msg
}

function mapRow(r: Record<string, unknown>): CalendarRow {
  return {
    id: r.id as string,
    academicYear: (r.academic_year as string) ?? '',
    fileUrl: (r.file_url as string) ?? '',
    fileName: (r.file_name as string | null) ?? null,
    fileSize: (r.file_size as number | null) ?? null,
    isCurrent: Boolean(r.is_current),
    uploadedAt: (r.uploaded_at as string | null) ?? null,
  }
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function defaultAcademicYear() {
  const now = new Date()
  // School year rolls over in July.
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${startYear}-${String(startYear + 1).slice(-2)}`
}

// ─── Upload modal ─────────────────────────────────────────────────────────────
function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [year, setYear] = useState(defaultAcademicYear())
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit() {
    if (!year.trim()) { toast('Enter the academic year', 'err'); return }
    if (!file) { toast('Choose a PDF file', 'err'); return }
    if (file.type !== 'application/pdf') { toast('Please choose a PDF file', 'err'); return }
    setBusy(true)
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, '_')
      const path = `academic-calendar/${Date.now()}_${safeName}`
      const url = await uploadFile(path, file)

      const { data: user } = await supabase.auth.getUser()
      // Demote every existing current calendar, then add the new one as current.
      const { error: demoteError } = await supabase
        .from('academic_calendars')
        .update({ is_current: false })
        .eq('is_current', true)
      if (demoteError) { toast(toDbErrorMessage(demoteError), 'err'); return }

      const { error: insertError } = await supabase
        .from('academic_calendars')
        .insert({
          academic_year: year.trim(),
          file_url: url,
          file_name: file.name,
          file_size: file.size,
          is_current: true,
          uploaded_by: user.user?.id ?? null,
          uploaded_at: new Date().toISOString(),
        })
      if (insertError) { toast(toDbErrorMessage(insertError), 'err'); return }

      toast('Academic calendar uploaded', 'ok')
      onDone()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Upload Academic Calendar</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>Academic year</span>
            <input
              value={year}
              onChange={e => setYear(e.target.value)}
              placeholder="2026-27"
              style={{ padding: '8px 10px', border: '1.5px solid #E4EAF2', borderRadius: 8, fontSize: 13, color: '#1A365E', outline: 'none' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1A365E' }}>Calendar PDF</span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
            <button onClick={() => inputRef.current?.click()} style={btn('#fff', '#1A365E')}>
              {file ? `📄 ${file.name}` : 'Choose file…'}
            </button>
          </label>

          <div style={{ fontSize: 11, color: '#7A92B0' }}>
            The uploaded calendar becomes the one students and parents see straight away. Previous
            calendars are kept in the history below.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={btn('#fff', '#1A365E')}>Cancel</button>
            <button onClick={() => void submit()} disabled={busy} style={{ ...btn('#D61F31'), opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Preview modal (history rows) ─────────────────────────────────────────────
function PreviewModal({ row, onClose }: { row: CalendarRow; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,24,50,0.6)', zIndex: 1100, display: 'flex', flexDirection: 'column', padding: 24 }}
      onClick={e => { if (e.currentTarget === e.target) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 14, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: 1000, width: '100%', margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Academic Calendar {row.academicYear}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => void downloadUrl(row.fileUrl, row.fileName || `Academic Calendar ${row.academicYear}.pdf`)} style={{ fontSize: 12, color: '#9EB3C8', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Download</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9EB3C8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <PdfPagedViewer url={row.fileUrl} />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function AcademicCalendarPage() {
  const [rows, setRows] = useState<CalendarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [preview, setPreview] = useState<CalendarRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    supabase
      .from('academic_calendars')
      .select('id,academic_year,file_url,file_name,file_size,is_current,uploaded_at')
      .order('is_current', { ascending: false })
      .order('uploaded_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { toast(toDbErrorMessage(error), 'err'); setRows([]); setLoading(false); return }
        setRows((data ?? []).map(mapRow))
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  const current = useMemo(() => rows.find(r => r.isCurrent) ?? rows[0] ?? null, [rows])
  const history = useMemo(() => rows.filter(r => r.id !== current?.id), [rows, current])

  const headerPortal = useHeaderActions(
    <button onClick={() => setShowUpload(true)} style={topbarBtn.primary}>
      ⬆ Upload calendar
    </button>,
  )

  async function makeCurrent(row: CalendarRow) {
    setBusyId(row.id)
    try {
      const { error: demote } = await supabase.from('academic_calendars').update({ is_current: false }).eq('is_current', true)
      if (demote) { toast(toDbErrorMessage(demote), 'err'); return }
      const { error } = await supabase.from('academic_calendars').update({ is_current: true }).eq('id', row.id)
      if (error) { toast(toDbErrorMessage(error), 'err'); return }
      toast(`${row.academicYear} is now the current calendar`, 'ok')
      load()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(row: CalendarRow) {
    if (!window.confirm(`Delete the ${row.academicYear} academic calendar? This cannot be undone.`)) return
    setBusyId(row.id)
    try {
      const { error } = await supabase.from('academic_calendars').delete().eq('id', row.id)
      if (error) { toast(toDbErrorMessage(error), 'err'); return }
      // Best-effort: remove the stored object too.
      try {
        const key = new URL(row.fileUrl).pathname.split('/uploads/')[1]
        if (key) await supabase.storage.from('uploads').remove([decodeURIComponent(key)])
      } catch { /* ignore */ }

      // If we deleted the current calendar, promote the most recent remaining one.
      if (row.isCurrent) {
        const { data } = await supabase
          .from('academic_calendars')
          .select('id')
          .order('uploaded_at', { ascending: false })
          .limit(1)
        const nextId = (data ?? [])[0]?.id as string | undefined
        if (nextId) await supabase.from('academic_calendars').update({ is_current: true }).eq('id', nextId)
      }
      toast('Calendar deleted', 'ok')
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...card }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A365E' }}>Academic Calendar</div>
          <div style={{ fontSize: 12, color: '#7A92B0', marginTop: 2 }}>
            Upload the school's annual academic calendar. Students and parents preview and download
            the calendar marked <strong>Current</strong> from their portals.
          </div>
        </div>

        {loading ? (
          <div style={{ ...card, textAlign: 'center', color: '#7A92B0' }}>Loading…</div>
        ) : !current ? (
          <div style={{ ...card, textAlign: 'center', color: '#7A92B0' }}>
            No calendar uploaded yet. Use <strong>Upload calendar</strong> to add one.
          </div>
        ) : (
          <>
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #E4EAF2' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1A365E' }}>{current.academicYear}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: '#DCFCE7', color: '#0E6B3B' }}>CURRENT</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 2 }}>
                    {current.fileName || 'calendar.pdf'}
                    {current.fileSize ? ` · ${formatSize(current.fileSize)}` : ''}
                    {current.uploadedAt ? ` · uploaded ${new Date(current.uploadedAt).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <button onClick={() => void downloadUrl(current.fileUrl, current.fileName || `Academic Calendar ${current.academicYear}.pdf`)} style={btn('#1A365E')}>
                  Download
                </button>
              </div>
              <div style={{ height: '70vh' }}>
                <PdfPagedViewer url={current.fileUrl} />
              </div>
            </div>

            {history.length > 0 && (
              <div style={{ ...card }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1A365E', marginBottom: 10 }}>Previous calendars</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map(row => (
                    <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 14px', background: '#F7F9FC', border: '1px solid #E4EAF2', borderRadius: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A365E' }}>{row.academicYear}</div>
                        <div style={{ fontSize: 11, color: '#7A92B0' }}>
                          {row.fileName || 'calendar.pdf'}
                          {row.uploadedAt ? ` · ${new Date(row.uploadedAt).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => setPreview(row)} style={btn('#fff', '#1A365E')}>Preview</button>
                        <button onClick={() => void makeCurrent(row)} disabled={busyId === row.id} style={btn('#1A365E')}>Make current</button>
                        <button onClick={() => void remove(row)} disabled={busyId === row.id} style={btn('#FFF0F1', '#D61F31')}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onDone={load} />}
      {preview && <PreviewModal row={preview} onClose={() => setPreview(null)} />}
    </>
  )
}
