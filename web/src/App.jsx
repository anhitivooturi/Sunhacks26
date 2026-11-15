import { Routes, Route, Navigate } from 'react-router-dom';
import StartScreen from './host/StartScreen.jsx';
import LiveScreen from './host/LiveScreen.jsx';
import ReportPage from './report/ReportPage.jsx';
import ClassesPage from './classes/ClassesPage.jsx';
import TeacherShell from './components/TeacherShell.jsx';
import { studentRoutes } from './student/routes.jsx';

// Route ownership: /host, /report, /classes = Person C. /j/:code, /join, /s/:code and /review/:sessionId = Person D (src/student).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/host" replace />} />
      <Route path="/host" element={<TeacherShell><StartScreen /></TeacherShell>} />
      <Route path="/host/:id" element={<TeacherShell calm><LiveScreen /></TeacherShell>} />
      <Route path="/host/:id/ta" element={<TeacherShell calm><LiveScreen taMode /></TeacherShell>} />
      <Route path="/report/:id" element={<TeacherShell><ReportPage /></TeacherShell>} />
      <Route path="/classes" element={<TeacherShell><ClassesPage /></TeacherShell>} />
      {studentRoutes}
      <Route path="*" element={<Navigate to="/host" replace />} />
    </Routes>
  );
}
