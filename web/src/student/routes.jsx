// Student routes. In the shared web/ app these are mounted from App.jsx:  {studentRoutes}
// Entry points: /j/:code (the QR link from the contract), /join (type the code), /s/:code (live), /review/:sessionId.
import { Route } from 'react-router-dom'
import './student.css'
import { SettingsProvider } from './components/SettingsContext.jsx'
import Join from './pages/Join.jsx'
import Live from './pages/Live.jsx'
import Review from './pages/Review.jsx'

const Shell = ({ fill, children }) => (
  <SettingsProvider>
    <div className={`ww page-in ${fill ? 'ww-fill' : ''}`}>{children}</div>
  </SettingsProvider>
)

export const studentRoutes = (
  <>
    <Route path="/j/:code" element={<Shell><Join /></Shell>} />
    <Route path="/join" element={<Shell><Join /></Shell>} />
    <Route path="/s/:code" element={<Shell fill><Live /></Shell>} />
    <Route path="/review/:sessionId" element={<Shell><Review /></Shell>} />
  </>
)
