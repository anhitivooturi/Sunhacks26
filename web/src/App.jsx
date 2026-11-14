import { Routes, Route, Navigate } from 'react-router-dom';
import StartScreen from './host/StartScreen.jsx';
import LiveScreen from './host/LiveScreen.jsx';
import ReportPage from './report/ReportPage.jsx';
import StudentPlaceholder from './student/StudentPlaceholder.jsx';

// Route ownership: /host + /report = Person C. /j/:code + /review = Person D (replace the placeholder).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/host" replace />} />
      <Route path="/host" element={<StartScreen />} />
      <Route path="/host/:id" element={<LiveScreen />} />
      <Route path="/host/:id/ta" element={<LiveScreen taMode />} />
      <Route path="/report/:id" element={<ReportPage />} />
      <Route path="/j/:code" element={<StudentPlaceholder />} />
      <Route path="*" element={<Navigate to="/host" replace />} />
    </Routes>
  );
}
