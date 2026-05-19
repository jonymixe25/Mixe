import fs from 'fs';

let home = fs.readFileSync('src/pages/Home.tsx', 'utf8');
home = home.replace('to="/studio"', 'to="/admin"'); // Reset first if previous failed or succeeded wrongly
home = home.replace('to="/admin"', 'to="/studio"');
fs.writeFileSync('src/pages/Home.tsx', home, 'utf8');

let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
layout = layout.replace("path: '/admin', label: 'Transmitir'", "path: '/studio', label: 'Transmitir'");
layout = layout.replace("path: '/dashboard', label: 'Admin'", "path: '/admin', label: 'Admin'");
fs.writeFileSync('src/components/Layout.tsx', layout, 'utf8');

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace('path="/admin" element={<AuthGuard><AdminStream /></AuthGuard>}', 'path="/studio" element={<AuthGuard><AdminStream /></AuthGuard>}');
app = app.replace('path="/dashboard" element={<AuthGuard requireAdmin><AdminDashboard /></AuthGuard>}', 'path="/admin" element={<AuthGuard requireAdmin><AdminDashboard /></AuthGuard>}');
fs.writeFileSync('src/App.tsx', app, 'utf8');
