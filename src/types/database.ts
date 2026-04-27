// Auto-generated types will go here once you run: npx supabase gen types typescript
// For now, this is a placeholder that will be replaced by the Supabase CLI

export type Database = {
  public: {
    Tables: {
      students: { Row: Student; Insert: StudentInsert; Update: Partial<StudentInsert> }
      courses: { Row: Course; Insert: CourseInsert; Update: Partial<CourseInsert> }
      catalog: { Row: CatalogEntry; Insert: CatalogEntry; Update: Partial<CatalogEntry> }
      attendance: { Row: AttendanceRecord; Insert: AttendanceInsert; Update: Partial<AttendanceInsert> }
      interviews: { Row: Interview; Insert: InterviewInsert; Update: Partial<InterviewInsert> }
      fees: { Row: Fee; Insert: FeeInsert; Update: Partial<FeeInsert> }
      communications: { Row: Communication; Insert: CommunicationInsert; Update: Partial<CommunicationInsert> }
      staff: { Row: StaffMember; Insert: StaffInsert; Update: Partial<StaffInsert> }
      calendar: { Row: CalendarEvent; Insert: CalendarInsert; Update: Partial<CalendarInsert> }
      health_records: { Row: HealthRecord; Insert: HealthInsert; Update: Partial<HealthInsert> }
      behaviour_log: { Row: BehaviourEntry; Insert: BehaviourInsert; Update: Partial<BehaviourInsert> }
      remarks: { Row: Remark; Insert: RemarkInsert; Update: Partial<RemarkInsert> }
      transfer_credits: { Row: TransferCredit; Insert: TransferCreditInsert; Update: Partial<TransferCreditInsert> }
      ec_de_credits: { Row: ECDECredit; Insert: ECDEInsert; Update: Partial<ECDEInsert> }
      graduation_requirements: { Row: GraduationRequirement; Insert: GraduationRequirementInsert; Update: Partial<GraduationRequirementInsert> }
      graduation_requirement_courses: { Row: GraduationRequirementCourse; Insert: GraduationRequirementCourseInsert; Update: Partial<GraduationRequirementCourseInsert> }
      graduation_distinctions: { Row: GraduationDistinction; Insert: GraduationDistinctionInsert; Update: Partial<GraduationDistinctionInsert> }
      tpms: { Row: TPMSEntry; Insert: TPMSInsert; Update: Partial<TPMSInsert> }
      at_assignments: { Row: Assignment; Insert: AssignmentInsert; Update: Partial<AssignmentInsert> }
      pt_projects: { Row: Project; Insert: ProjectInsert; Update: Partial<ProjectInsert> }
      settings: { Row: Settings; Insert: Settings; Update: Partial<Settings> }
      profiles: { Row: Profile; Insert: ProfileInsert; Update: Partial<ProfileInsert> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      student_status: 'Applied' | 'Under Review' | 'Accepted' | 'Denied' | 'Waitlisted' | 'Inquiry' | 'Enrolled' | 'Alumni' | 'Withdrawn'
      attendance_status: 'Present' | 'Absent' | 'Late' | 'Excused'
      user_role: 'admin' | 'staff' | 'teacher' | 'principal' | 'partner' | 'coach' | 'viewer' | 'counselor' | 'readonly'
    }
  }
}

// ─── Student ──────────────────────────────────────────────────────────────────
export interface Student {
  id: string
  student_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  nationality: string | null
  grade: number | null
  cohort: string | null
  campus: string | null
  status: Database['public']['Enums']['student_status']
  enroll_date: string | null
  application_date: string | null
  year_joined: string | null
  year_graduated: string | null
  grade_when_joined: number | null
  parent: string | null
  iep: boolean
  support_needs: string | null
  priority: string | null
  created_at: string
  updated_at: string
}
export type StudentInsert = Omit<Student, 'id' | 'created_at' | 'updated_at'>

// ─── Course ───────────────────────────────────────────────────────────────────
export interface Course {
  id: string
  student_id: string
  catalog_code: string
  title: string
  type: 'STD' | 'HON' | 'AP' | 'IB' | 'DE' | 'EC' | 'CR'
  area: string
  credits: number
  grade_letter: string | null
  grade_percent: number | null
  ap_score: number | null
  ib_score: number | null
  term: string | null
  academic_year: string
  created_at: string
}
export type CourseInsert = Omit<Course, 'id' | 'created_at'>

// ─── Catalog ──────────────────────────────────────────────────────────────────
export interface CatalogEntry {
  id: string
  code: string
  title: string
  type: 'STD' | 'HON' | 'AP' | 'IB' | 'DE' | 'EC' | 'CR'
  area: string
  credits: number
  description: string | null
}

// ─── Attendance ───────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: string
  student_id: string
  date: string
  status: Database['public']['Enums']['attendance_status']
  note: string | null
  recorded_by: string | null
  created_at: string
}
export type AttendanceInsert = Omit<AttendanceRecord, 'id' | 'created_at'>

// ─── Interview ────────────────────────────────────────────────────────────────
export interface Interview {
  id: string
  student_id: string
  date: string
  time: string | null
  score: number | null
  notes: string | null
  interviewer: string | null
  outcome: string | null
  created_at: string
}
export type InterviewInsert = Omit<Interview, 'id' | 'created_at'>

// ─── Fee ──────────────────────────────────────────────────────────────────────
export interface Fee {
  id: string
  student_id: string
  type: string
  amount: number
  currency: string
  paid: boolean
  paid_date: string | null
  note: string | null
  created_at: string
}
export type FeeInsert = Omit<Fee, 'id' | 'created_at'>

// ─── Communication ────────────────────────────────────────────────────────────
export interface Communication {
  id: string
  student_id: string
  date: string
  type: string
  outcome: string | null
  notes: string | null
  staff_member: string | null
  created_at: string
}
export type CommunicationInsert = Omit<Communication, 'id' | 'created_at'>

// ─── Staff ────────────────────────────────────────────────────────────────────
export interface StaffMember {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  department: string | null
  campus: string | null
  active: boolean
  created_at: string
}
export type StaffInsert = Omit<StaffMember, 'id' | 'created_at'>

// ─── Calendar ─────────────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string
  title: string
  date: string
  end_date: string | null
  type: string
  description: string | null
  campus: string | null
  created_at: string
}
export type CalendarInsert = Omit<CalendarEvent, 'id' | 'created_at'>

// ─── Health ───────────────────────────────────────────────────────────────────
export interface HealthRecord {
  id: string
  student_id: string
  allergies: string | null
  medications: string | null
  conditions: string | null
  immunizations: string | null
  notes: string | null
  updated_at: string
}
export type HealthInsert = Omit<HealthRecord, 'id' | 'updated_at'>

// ─── Behaviour ────────────────────────────────────────────────────────────────
export interface BehaviourEntry {
  id: string
  student_id: string
  date: string
  type: string
  description: string | null
  action_taken: string | null
  staff_member: string | null
  created_at: string
}
export type BehaviourInsert = Omit<BehaviourEntry, 'id' | 'created_at'>

// ─── Remarks ──────────────────────────────────────────────────────────────────
export interface Remark {
  id: string
  student_id: string
  term: string
  academic_year: string
  content: string
  author: string | null
  created_at: string
}
export type RemarkInsert = Omit<Remark, 'id' | 'created_at'>

// ─── Transfer Credits ─────────────────────────────────────────────────────────
export interface TransferCredit {
  id: string
  student_id: string
  institution: string
  course_title: string
  credits: number
  grade_letter: string | null
  year: string | null
  created_at: string
}
export type TransferCreditInsert = Omit<TransferCredit, 'id' | 'created_at'>

// ─── EC/DE Credits ────────────────────────────────────────────────────────────
export interface ECDECredit {
  id: string
  student_id: string
  type: 'EC' | 'DE'
  institution: string
  course_title: string
  college_credits: number
  hs_credits: number
  grade_letter: string | null
  academic_year: string
  created_at: string
}
export type ECDEInsert = Omit<ECDECredit, 'id' | 'created_at'>

// ─── TPMS ─────────────────────────────────────────────────────────────────────
export interface TPMSEntry {
  id: string
  type: 'lesson' | 'unit' | 'event' | 'pd'
  title: string
  staff_id: string | null
  date: string | null
  content: string | null
  status: string | null
  created_at: string
}
export type TPMSInsert = Omit<TPMSEntry, 'id' | 'created_at'>

// ─── Assignment ───────────────────────────────────────────────────────────────
export interface Assignment {
  id: string
  title: string
  cohort: string | null
  subject: string | null
  due_date: string | null
  max_score: number | null
  academic_year: string
  created_by: string | null
  created_at: string
}
export type AssignmentInsert = Omit<Assignment, 'id' | 'created_at'>

// ─── Project ──────────────────────────────────────────────────────────────────
export interface Project {
  id: string
  title: string
  student_id: string | null
  cohort: string | null
  due_date: string | null
  status: string | null
  score: number | null
  feedback: string | null
  created_at: string
}
export type ProjectInsert = Omit<Project, 'id' | 'created_at'>

// ─── Settings ─────────────────────────────────────────────────────────────────
export interface Settings {
  id: string
  academic_year: string
  campuses: string[]
  cohorts: string[]
  grading_scale: Record<string, number>
  graduation_credits: number
  associate_degree_credits_required: number
  email_notifications: boolean
  updated_at: string
}

export interface GraduationRequirement {
  id: string
  key: string
  label: string
  area: string
  required_credits: number
  icon: string | null
  mandatory_note: string | null
  sort_order: number
}
export type GraduationRequirementInsert = Omit<GraduationRequirement, 'id'>

export interface GraduationRequirementCourse {
  id: string
  requirement_id: string
  course_title: string
  sort_order: number
}
export type GraduationRequirementCourseInsert = Omit<GraduationRequirementCourse, 'id'>

export interface GraduationDistinction {
  id: string
  label: string
  icon: string | null
  color: string | null
  weighted_gpa_required: number
  sort_order: number
}
export type GraduationDistinctionInsert = Omit<GraduationDistinction, 'id'>

// ─── Profile (linked to Supabase Auth) ───────────────────────────────────────
export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Database['public']['Enums']['user_role']
  campus: string | null
  active: boolean
  avatar_url: string | null
  created_at: string
}
export type ProfileInsert = Omit<Profile, 'created_at'>
