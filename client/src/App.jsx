import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import Layout from './components/Layout'
import RFQListPage from './pages/RFQListPage'
import RFQDetailPage from './pages/RFQDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/rfq" replace />} />
          <Route path="/rfq" element={<RFQListPage />} />
          <Route path="/rfq/:id" element={<RFQDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
