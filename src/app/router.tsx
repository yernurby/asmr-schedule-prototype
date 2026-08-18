import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { ModuleMapPage } from '../pages/ModuleMapPage'
import { RequirementsPage } from '../pages/RequirementsPage'
import { CoursesPage } from '../pages/CoursesPage'
import { GroupsPage } from '../pages/GroupsPage'
import { GroupDetailPage } from '../pages/GroupDetailPage'
import { StaffPage } from '../pages/StaffPage'
import { PayrollPage } from '../pages/PayrollPage'
import { StudentsPage } from '../pages/StudentsPage'
import { StudentPortalPage } from '../pages/StudentPortalPage'
import { LessonsPage } from '../pages/LessonsPage'
import { LessonDetailPage } from '../pages/LessonDetailPage'
import { MigrationPage } from '../pages/MigrationPage'
import { AuditLogPage } from '../pages/AuditLogPage'
import { useSessionStore } from '../store/useSessionStore'
import { homeFor } from './navigation'

export function AppRoutes() {
  const role = useSessionStore((s) => s.role)

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={homeFor(role)} replace />} />
        <Route path="/module-map" element={<ModuleMapPage />} />
        <Route path="/requirements" element={<RequirementsPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        <Route path="/lessons" element={<LessonsPage />} />
        <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        <Route path="/migration" element={<MigrationPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/me" element={<StudentPortalPage />} />
        <Route path="*" element={<Navigate to="/module-map" replace />} />
      </Route>
    </Routes>
  )
}
