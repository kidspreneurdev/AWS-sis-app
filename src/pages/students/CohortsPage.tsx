import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { StudentStatus } from '@/types/student'
import { useHeaderActions } from '@/contexts/PageHeaderContext'
import { useCampusFilter } from '@/hooks/useCampusFilter'

interface StudentMin {
  id: string
  firstName: string
  lastName: string
  grade: number | null
  cohort: string | null
  status: StudentStatus
}

function fromRow(r: Record<string, unknown>): StudentMin {
  return {
    id: r.id as string,
    firstName: r.first_name as string ?? '',
    lastName: r.last_name as string ?? '',
    grade: r.grade as number ?? null,
    cohort: r.cohort as string ?? null,
    status: r.status as StudentStatus ?? 'Enrolled',
  }
}

function initials(s: StudentMin) {
  return `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`.toUpperCase()
}

const CAPACITY = 20

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10,
  border: '1px solid #E4EAF2', boxShadow: '0 2px 8px rgba(26,54,94,.08)',
}

// ─── Assign Students Modal ────────────────────────────────────────────────────
function AssignModal({
  cohort, unassigned, onAssign, onClose,
}: {
  cohort: string
  unassigned: StudentMin[]
  onAssign: (ids: string[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return unassigned
    return unassigned.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
    )
  }, [unassigned, search])

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,25,50,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0F2240,#1A365E)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Assign Students</div>
            <div style={{ fontSize: 12, color: '#9EB3C8', marginTop: 2 }}>to {cohort}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E4EAF2' }}>
          <input
            style={{ width: '100%', height: 34, borderRadius: 8, border: '1px solid #E4EAF2', padding: '0 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            placeholder="Search students…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#9EB3C8', fontSize: 13 }}>
              All enrolled students are already assigned
            </div>
          ) : filtered.map(s => (
            <div
              key={s.id}
              onClick={() => toggle(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                background: selected.has(s.id) ? '#EEF5FF' : 'transparent',
                border: `1px solid ${selected.has(s.id) ? '#C8DEFF' : 'transparent'}`,
                marginBottom: 4, transition: 'all .12s',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: selected.has(s.id) ? '#1A365E' : '#EEF3FF',
                color: selected.has(s.id) ? '#fff' : '#1A365E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, flexShrink: 0,
              }}>
                {selected.has(s.id) ? '✓' : initials(s)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A365E' }}>{s.firstName} {s.lastName}</div>
                <div style={{ fontSize: 11, color: '#9EB3C8' }}>{s.grade !== null ? `Grade ${s.grade}` : 'No grade'}</div>
              </div>
              <StatusBadge status={s.status} size="sm" />
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #E4EAF2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F7F9FC' }}>
          <span style={{ fontSize: 12, color: '#7A92B0' }}>{selected.size} selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#fff', color: '#1A365E', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={() => { if (selected.size > 0) { onAssign([...selected]); onClose() } }}
              disabled={selected.size === 0}
              style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: selected.size > 0 ? '#D61F31' : '#C4D0DE', color: '#fff', fontSize: 13, fontWeight: 700, cursor: selected.size > 0 ? 'pointer' : 'not-allowed' }}
            >
              Assign {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function CohortsPage() {
  const cf = useCampusFilter()
  const [students, setStudents] = useState<StudentMin[]>([])
  const [cohortNames, setCohortNames] = useState<string[]>([])
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [assigningTo, setAssigningTo] = useState<string | null>(null)

  useEffect(() => { load() }, [cf])

  async function load() {
    setLoading(true)
    let sQuery = supabase.from('students').select('id,first_name,last_name,grade,cohort,status').eq('status', 'Enrolled')
    if (cf) sQuery = sQuery.eq('campus', cf)
    const [sRes, setRes] = await Promise.all([
      sQuery,
      supabase.from('settings').select('id,cohorts').single(),
    ])
    setStudents((sRes.data ?? []).map(fromRow))
    const raw = (setRes.data?.cohorts as string[]) ?? []
    const cleaned = raw.map(v => String(v).replace(/^[\["\s]+|[\]"\s]+$/g, '').trim()).filter(Boolean)
    // If data was dirty, write the clean version back immediately
    if (raw.some((v, i) => v !== cleaned[i])) {
      await supabase.from('settings').update({ cohorts: cleaned }).eq('id', setRes.data?.id)
    }
    setCohortNames(cleaned)
    setSettingsId(setRes.data?.id ?? null)
    setLoading(false)
  }

  async function saveCohorts(next: string[]) {
    if (!settingsId) return
    await supabase.from('settings').update({ cohorts: next }).eq('id', settingsId)
    setCohortNames(next)
  }

  async function addCohort() {
    const name = prompt('Cohort name:')?.trim()
    if (!name) return
    if (cohortNames.includes(name)) { alert('A cohort with that name already exists.'); return }
    await saveCohorts([...cohortNames, name])
  }

  async function removeCohort(name: string) {
    if (!confirm(`Remove cohort "${name}"? All students will be unassigned.`)) return
    await supabase.from('students').update({ cohort: null }).eq('cohort', name)
    setStudents(prev => prev.map(s => s.cohort === name ? { ...s, cohort: null } : s))
    await saveCohorts(cohortNames.filter(c => c !== name))
  }

  async function removeFromCohort(studentId: string) {
    await supabase.from('students').update({ cohort: null }).eq('id', studentId)
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, cohort: null } : s))
  }

  async function assignStudents(cohortName: string, ids: string[]) {
    await Promise.all(ids.map(id => supabase.from('students').update({ cohort: cohortName }).eq('id', id)))
    setStudents(prev => prev.map(s => ids.includes(s.id) ? { ...s, cohort: cohortName } : s))
  }

  const enrolled = students
  const unassigned = enrolled.filter(s => !s.cohort)
  const assigned = enrolled.filter(s => s.cohort)

  const stats = [
    { label: 'Total Cohorts', value: cohortNames.length, color: '#1A365E' },
    { label: 'Assigned Students', value: assigned.length, color: '#0369A1' },
    { label: 'Unassigned Enrolled', value: unassigned.length, color: unassigned.length > 0 ? '#D61F31' : '#047857' },
    { label: 'Total Capacity', value: cohortNames.length * CAPACITY, color: '#7C3AED' },
  ]

  const headerPortal = useHeaderActions(
    <button onClick={addCohort} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#D61F31', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ New Cohort</button>
  )

  return (
    <>
      {headerPortal}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...card, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: '#7A92B0', fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#9EB3C8' }}>Loading…</div>
      ) : (
        <>
          {/* Unassigned warning */}
          {unassigned.length > 0 && (
            <div style={{
              ...card, padding: 16,
              background: '#FFF6E0', border: '1px solid #F5A623',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚠️</span>
                {unassigned.length} enrolled student{unassigned.length !== 1 ? 's' : ''} not assigned to any cohort
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {unassigned.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#fff', border: '1px solid #F5A623',
                    borderRadius: 20, padding: '4px 10px',
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: '#FEF3C7', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                      {initials(s)}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>{s.firstName} {s.lastName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cohort cards */}
          {cohortNames.length === 0 ? (
            <div style={{ ...card, padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1A365E' }}>No cohorts yet</div>
              <div style={{ fontSize: 13, color: '#7A92B0', marginTop: 4 }}>Click "+ New Cohort" to create one</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cohortNames.map(cohortName => {
                const members = students.filter(s => s.cohort === cohortName)
                const enrolledMembers = members.filter(s => s.status === 'Enrolled')
                const grades = [...new Set(members.map(s => s.grade).filter(v => v !== null) as number[])].sort((a, b) => a - b)
                const pct = Math.min(100, Math.round((enrolledMembers.length / CAPACITY) * 100))
                const unassignedForThis = enrolled.filter(s => !s.cohort)

                return (
                  <div key={cohortName} style={card}>
                    {/* Cohort header */}
                    <div style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid #F0F4FA',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      flexWrap: 'wrap', gap: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1A365E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                          👥
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A365E' }}>{cohortName}</div>
                          <div style={{ fontSize: 11, color: '#7A92B0', marginTop: 1 }}>
                            {enrolledMembers.length} enrolled · {members.length} total
                            {grades.length > 0 && ` · Grades ${grades.join(', ')}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={() => setAssigningTo(cohortName)}
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #E4EAF2', background: '#EEF5FF', color: '#1A365E', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          + Assign Students
                        </button>
                        <button
                          onClick={() => removeCohort(cohortName)}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #FEE2E2', background: '#FFF0F1', color: '#D61F31', fontSize: 12, cursor: 'pointer' }}
                          title="Remove cohort"
                        >
                          🗑
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ padding: '10px 18px', borderBottom: '1px solid #F0F4FA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#7A92B0' }}>Capacity</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 90 ? '#D61F31' : pct >= 70 ? '#F5A623' : '#1DBD6A' }}>
                          {enrolledMembers.length} / {CAPACITY}
                        </span>
                      </div>
                      <div style={{ background: '#F0F4FA', borderRadius: 20, height: 6 }}>
                        <div style={{
                          width: `${pct}%`, height: 6, borderRadius: 20,
                          background: pct >= 90 ? '#D61F31' : pct >= 70 ? '#F5A623' : '#1DBD6A',
                          transition: 'width .3s',
                        }} />
                      </div>
                    </div>

                    {/* Student chips */}
                    <div style={{ padding: 14 }}>
                      {members.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9EB3C8', fontSize: 12 }}>
                          No students assigned yet
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {members.map(s => (
                            <div
                              key={s.id}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                background: '#F7F9FC', border: '1px solid #E4EAF2',
                                borderRadius: 10, padding: '6px 10px',
                                transition: 'border-color .15s',
                              }}
                            >
                              <div style={{
                                width: 28, height: 28, borderRadius: 7,
                                background: '#1A365E', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 800, flexShrink: 0,
                              }}>
                                {initials(s)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#1A365E', whiteSpace: 'nowrap' }}>
                                  {s.firstName} {s.lastName}
                                </div>
                                <div style={{ marginTop: 2 }}>
                                  <StatusBadge status={s.status} size="sm" />
                                </div>
                              </div>
                              <button
                                onClick={() => removeFromCohort(s.id)}
                                title="Remove from cohort"
                                style={{
                                  background: 'none', border: 'none',
                                  color: '#C4D0DE', cursor: 'pointer',
                                  fontSize: 14, padding: '0 2px',
                                  lineHeight: 1, flexShrink: 0,
                                }}
                                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#D61F31'}
                                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#C4D0DE'}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Assign modal */}
                    {assigningTo === cohortName && (
                      <AssignModal
                        cohort={cohortName}
                        unassigned={unassignedForThis}
                        onAssign={ids => assignStudents(cohortName, ids)}
                        onClose={() => setAssigningTo(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
    </>
  )
}
