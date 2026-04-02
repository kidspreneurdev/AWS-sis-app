import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { StudentPortalLayout } from '@/components/layout/StudentPortalLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'

// ─── Students ─────────────────────────────────────────────────────────────────
import { ApplicationsPage } from '@/pages/students/ApplicationsPage'
import { StudentsPage } from '@/pages/students/StudentsPage'
import { WaitlistPage } from '@/pages/students/WaitlistPage'
import { AlumniPage } from '@/pages/students/AlumniPage'
import { CohortsPage } from '@/pages/students/CohortsPage'
import { DocumentsPage } from '@/pages/students/DocumentsPage'
import { StudentGoalsPage } from '@/pages/students/StudentGoalsPage'
import { Student360Page } from '@/pages/students/Student360Page'
import { AttendancePage } from '@/pages/academic/AttendancePage'
import { GradesHSPage } from '@/pages/academic/GradesHSPage'
import { GradesLSPage } from '@/pages/academic/GradesLSPage'
import { AnalyticsPage } from '@/pages/admissions/AnalyticsPage'
import { InterviewsPage } from '@/pages/admissions/InterviewsPage'
import { FeesPage } from '@/pages/admissions/FeesPage'
import { CommunicationsPage } from '@/pages/admissions/CommunicationsPage'
import { ReportCardsPage } from '@/pages/admissions/ReportCardsPage'

// ─── Performance & Operations ─────────────────────────────────────────────────
import { SchoolPerformancePage } from '@/pages/dashboard/SchoolPerformancePage'
import { HealthRecordsPage } from '@/pages/operations/HealthRecordsPage'
import { BehaviourLogPage } from '@/pages/operations/BehaviourLogPage'
import { AlertsPage } from '@/pages/admin/AlertsPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { UserManagementPage } from '@/pages/admin/UserManagementPage'
import { StaffDirectoryPage } from '@/pages/admin/StaffDirectoryPage'

// ─── Calendar & Teaching/Planning ─────────────────────────────────────────────
import { CalendarPage } from '@/pages/academic/CalendarPage'
import { TPMSDashboardPage } from '@/pages/tpms/TPMSDashboardPage'
import { LessonPlansPage } from '@/pages/tpms/LessonPlansPage'
import { UnitPlansPage } from '@/pages/tpms/UnitPlansPage'
import { BlocksPage } from '@/pages/tpms/BlocksPage'
import { CurriculumMapPage } from '@/pages/tpms/CurriculumMapPage'
import { ProfDevPage } from '@/pages/tpms/ProfDevPage'
import { TeachingAnalyticsPage } from '@/pages/tpms/TeachingAnalyticsPage'

// ─── Assignment Tracker (AT) ──────────────────────────────────────────────────
import { ATDashboardPage } from '@/pages/at/ATDashboardPage'
import { ATAssignmentsPage } from '@/pages/at/ATAssignmentsPage'
import { ATWeeklyPage } from '@/pages/at/ATWeeklyPage'
import { ATExactPathPage } from '@/pages/at/ATExactPathPage'
import { ATAssessmentPage } from '@/pages/at/ATAssessmentPage'
import { ATNotesPage } from '@/pages/at/ATNotesPage'
import { ATLatePage } from '@/pages/at/ATLatePage'
import { ATReportsPage } from '@/pages/at/ATReportsPage'

// ─── Learning Management System (LMS) ────────────────────────────────────────
import { LMSPage } from '@/pages/lms/LMSPage'

// ─── Projects Tracker (PT) ────────────────────────────────────────────────────
import { PTDashboardPage } from '@/pages/pt/PTDashboardPage'
import { PTAssignPage } from '@/pages/pt/PTAssignPage'
import { PTTrackPage } from '@/pages/pt/PTTrackPage'
import { PTEvaluatePage } from '@/pages/pt/PTEvaluatePage'
import { PTReportsPage } from '@/pages/pt/PTReportsPage'

// ─── Student Portal ───────────────────────────────────────────────────────────
import { StudentPortalLoginPage } from '@/pages/student-portal/StudentPortalLoginPage'
import { SPDashboardPage } from '@/pages/student-portal/SPDashboardPage'
import { SPGradesPage } from '@/pages/student-portal/SPGradesPage'
import { SPAttendancePage } from '@/pages/student-portal/SPAttendancePage'
import { SPAssignmentsPage } from '@/pages/student-portal/SPAssignmentsPage'
import { SPMyLearningPage } from '@/pages/student-portal/SPMyLearningPage'
import { SPProjectPage } from '@/pages/student-portal/SPProjectPage'
import { SPPortfolioPage } from '@/pages/student-portal/SPPortfolioPage'
import { SPGoalsPage } from '@/pages/student-portal/SPGoalsPage'
import { SPSkillsPage } from '@/pages/student-portal/SPSkillsPage'
import { SPWellnessPage } from '@/pages/student-portal/SPWellnessPage'
import { SPInnovationLabPage } from '@/pages/student-portal/SPInnovationLabPage'
import { SPRealWorldLogPage } from '@/pages/student-portal/SPRealWorldLogPage'
import { SPFeesPage } from '@/pages/student-portal/SPFeesPage'
import { SPDocumentsPage } from '@/pages/student-portal/SPDocumentsPage'
import { SPBadgesPage } from '@/pages/student-portal/SPBadgesPage'
import { SPProfilePage } from '@/pages/student-portal/SPProfilePage'

function PageLoader() {
  return <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #E4EAF2', borderTopColor: '#D61F31', animation: 'spin 0.7s linear infinite' }} />
  </div>
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },

  // ─── Student Portal ────────────────────────────────────────────────────────
  {
    path: '/portal/login',
    element: <StudentPortalLoginPage />,
  },
  {
    element: <StudentPortalLayout />,
    children: [
      { path: '/portal/dashboard', element: <SPDashboardPage /> },
      { path: '/portal/grades', element: <SPGradesPage /> },
      { path: '/portal/attendance', element: <SPAttendancePage /> },
      { path: '/portal/assignments', element: <SPAssignmentsPage /> },
      { path: '/portal/learning', element: <SPMyLearningPage /> },
      { path: '/portal/project', element: <SPProjectPage /> },
      { path: '/portal/portfolio', element: <SPPortfolioPage /> },
      { path: '/portal/goals', element: <SPGoalsPage /> },
      { path: '/portal/skills', element: <SPSkillsPage /> },
      { path: '/portal/wellness', element: <SPWellnessPage /> },
      { path: '/portal/lab', element: <SPInnovationLabPage /> },
      { path: '/portal/rwlog', element: <SPRealWorldLogPage /> },
      { path: '/portal/fees', element: <SPFeesPage /> },
      { path: '/portal/documents', element: <SPDocumentsPage /> },
      { path: '/portal/badges', element: <SPBadgesPage /> },
      { path: '/portal/profile', element: <SPProfilePage /> },
    ],
  },

  // ─── Admin App ────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [{
      element: <AppLayout />,
      children: [
        { path: '/dashboard', element: <DashboardPage /> },
        { path: '/performance', element: <Lazy><SchoolPerformancePage /></Lazy> },

        // Students
        { path: '/students/applications', element: <Lazy><ApplicationsPage /></Lazy> },
        { path: '/students/enrolled', element: <Lazy><StudentsPage /></Lazy> },
        { path: '/students/waitlist', element: <Lazy><WaitlistPage /></Lazy> },
        { path: '/students/alumni', element: <Lazy><AlumniPage /></Lazy> },
        { path: '/students/cohorts', element: <Lazy><CohortsPage /></Lazy> },
        { path: '/students/documents', element: <Lazy><DocumentsPage /></Lazy> },
        { path: '/students/goals', element: <Lazy><StudentGoalsPage /></Lazy> },
        { path: '/students/360', element: <Lazy><Student360Page /></Lazy> },

        // Admissions
        { path: '/grades/hs', element: <Lazy><GradesHSPage /></Lazy> },
        { path: '/grades/ls', element: <Lazy><GradesLSPage /></Lazy> },
        { path: '/admissions/analytics', element: <Lazy><AnalyticsPage /></Lazy> },
        { path: '/attendance', element: <Lazy><AttendancePage /></Lazy> },
        { path: '/admissions/interviews', element: <Lazy><InterviewsPage /></Lazy> },
        { path: '/admissions/fees', element: <Lazy><FeesPage /></Lazy> },
        { path: '/admissions/communications', element: <Lazy><CommunicationsPage /></Lazy> },
        { path: '/admissions/reportcards', element: <Lazy><ReportCardsPage /></Lazy> },
        { path: '/academic/calendar', element: <Lazy><CalendarPage /></Lazy> },

        // Teaching & Planning
        { path: '/tpms/dashboard', element: <Lazy><TPMSDashboardPage /></Lazy> },
        { path: '/tpms/lessons', element: <Lazy><LessonPlansPage /></Lazy> },
        { path: '/tpms/units', element: <Lazy><UnitPlansPage /></Lazy> },
        { path: '/tpms/blocks', element: <Lazy><BlocksPage /></Lazy> },
        { path: '/tpms/curriculum', element: <Lazy><CurriculumMapPage /></Lazy> },
        { path: '/tpms/pd', element: <Lazy><ProfDevPage /></Lazy> },
        { path: '/tpms/analytics', element: <Lazy><TeachingAnalyticsPage /></Lazy> },

        // Operations
        { path: '/operations/health', element: <Lazy><HealthRecordsPage /></Lazy> },
        { path: '/operations/behaviour', element: <Lazy><BehaviourLogPage /></Lazy> },

        // Assignment Tracker
        { path: '/at/dashboard', element: <Lazy><ATDashboardPage /></Lazy> },
        { path: '/at/assignments', element: <Lazy><ATAssignmentsPage /></Lazy> },
        { path: '/at/weekly', element: <Lazy><ATWeeklyPage /></Lazy> },
        { path: '/at/exactpath', element: <Lazy><ATExactPathPage /></Lazy> },
        { path: '/at/assessment', element: <Lazy><ATAssessmentPage /></Lazy> },
        { path: '/at/notes', element: <Lazy><ATNotesPage /></Lazy> },
        { path: '/at/late', element: <Lazy><ATLatePage /></Lazy> },
        { path: '/at/reports', element: <Lazy><ATReportsPage /></Lazy> },

        // Projects Tracker
        { path: '/pt/dashboard', element: <Lazy><PTDashboardPage /></Lazy> },
        { path: '/pt/assign', element: <Lazy><PTAssignPage /></Lazy> },
        { path: '/pt/track', element: <Lazy><PTTrackPage /></Lazy> },
        { path: '/pt/evaluate', element: <Lazy><PTEvaluatePage /></Lazy> },
        { path: '/pt/reports', element: <Lazy><PTReportsPage /></Lazy> },

        // Learning Management System
        { path: '/lms/manage', element: <Lazy><LMSPage /></Lazy> },
        { path: '/lms/courses', element: <Lazy><LMSPage /></Lazy> },
        { path: '/lms/content', element: <Lazy><LMSPage /></Lazy> },
        { path: '/lms/assign', element: <Lazy><LMSPage /></Lazy> },
        { path: '/lms/gradebook', element: <Lazy><LMSPage /></Lazy> },
        { path: '/lms/section', element: <Lazy><LMSPage /></Lazy> },
        { path: '/lms/progress', element: <Lazy><LMSPage /></Lazy> },

        // Settings
        { path: '/admin/alerts', element: <Lazy><AlertsPage /></Lazy> },
        { path: '/admin/settings', element: <Lazy><SettingsPage /></Lazy> },
        { path: '/admin/users', element: <Lazy><UserManagementPage /></Lazy> },
        { path: '/admin/staff', element: <Lazy><StaffDirectoryPage /></Lazy> },
      ],
    }],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])
