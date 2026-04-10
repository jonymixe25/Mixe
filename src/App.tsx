/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './AuthContext';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import React, { Suspense, lazy } from 'react';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import MaintenanceGuard from './components/MaintenanceGuard';

const Home = lazy(() => import('./pages/Home'));
const Profile = lazy(() => import('./pages/Profile'));
const Contacts = lazy(() => import('./pages/Contacts'));
const AdminStream = lazy(() => import('./pages/AdminStream'));
const StreamView = lazy(() => import('./pages/StreamView'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const News = lazy(() => import('./pages/News'));
const Chat = lazy(() => import('./pages/Chat'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Register = lazy(() => import('./pages/Register'));
const FileStorage = lazy(() => import('./pages/FileStorage'));
const GlobalSettings = lazy(() => import('./pages/GlobalSettings'));
const WebPlatform = lazy(() => import('./pages/WebPlatform'));

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <HelmetProvider>
          <Router>
            <Layout>
              <MaintenanceGuard>
                <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Cargando...</div>}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
                    <Route path="/contacts" element={<AuthGuard><Contacts /></AuthGuard>} />
                    <Route path="/chat/:contactId" element={<AuthGuard><Chat /></AuthGuard>} />
                    <Route path="/gallery" element={<AuthGuard><Gallery /></AuthGuard>} />
                    <Route path="/admin" element={<AuthGuard><AdminStream /></AuthGuard>} />
                    <Route path="/dashboard" element={<AuthGuard requireAdmin><AdminDashboard /></AuthGuard>} />
                    <Route path="/settings" element={<AuthGuard requireAdmin><GlobalSettings /></AuthGuard>} />
                    <Route path="/stream/:id" element={<StreamView />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/files" element={<AuthGuard><FileStorage /></AuthGuard>} />
                    <Route path="/web" element={<WebPlatform />} />
                  </Routes>
                </Suspense>
              </MaintenanceGuard>
            </Layout>
          </Router>
          <Analytics />
        </HelmetProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}
