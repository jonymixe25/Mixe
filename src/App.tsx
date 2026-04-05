/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Contacts from './pages/Contacts';
import AdminStream from './pages/AdminStream';
import StreamView from './pages/StreamView';
import AdminDashboard from './pages/AdminDashboard';
import News from './pages/News';
import Chat from './pages/Chat';
import Gallery from './pages/Gallery';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/news" element={<News />} />
              <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
              <Route path="/contacts" element={<AuthGuard><Contacts /></AuthGuard>} />
              <Route path="/chat/:contactId" element={<AuthGuard><Chat /></AuthGuard>} />
              <Route path="/gallery" element={<AuthGuard><Gallery /></AuthGuard>} />
              <Route path="/admin" element={<AuthGuard><AdminStream /></AuthGuard>} />
              <Route path="/dashboard" element={<AuthGuard requireAdmin><AdminDashboard /></AuthGuard>} />
              <Route path="/stream/:id" element={<StreamView />} />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}
