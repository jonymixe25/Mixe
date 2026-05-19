import fs from 'fs';
import path from 'path';

const file = './src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The alert form
content = content.replace(/className="space-y-10 glass p-10 rounded-3xl border-black\/\[0\.04\] "/g, 'className="space-y-10 bg-white p-10 rounded-3xl border border-black/[0.04] shadow-sm"');
content = content.replace(/glass rounded-3xl border-dashed border-black\/\[0\.04\] /g, 'bg-white rounded-3xl border border-dashed border-black/[0.08] shadow-sm ');

// History of alerts cards
content = content.replace(/p-6 glass rounded-3xl border-black\/\[0\.04\]/g, 'p-6 bg-white rounded-2xl border border-black/[0.04] shadow-sm');

// Loading state
content = content.replace(/py-32 flex flex-col items-center justify-center gap-6 glass rounded-3xl/g, 'py-32 flex flex-col items-center justify-center gap-6 bg-white rounded-3xl border border-black/[0.04] shadow-sm');

fs.writeFileSync(file, content, 'utf8');
console.log('Admin dashboard refines 2');
