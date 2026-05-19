import fs from 'fs';
import path from 'path';

const file = './src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The news form
content = content.replace(/glass rounded-3xl p-6 border-dashed border-black\/\[0\.04\]/g, 'bg-black/[0.02] rounded-3xl p-6 border border-dashed border-black/[0.08]');
content = content.replace(/w-full bg-brand text-black px-10 py-5 rounded-xl font-semibold uppercase tracking-wider/g, 'w-full bg-brand text-white px-10 py-5 rounded-xl font-semibold uppercase tracking-wider hover:opacity-90 border-transparent shadow-md');
content = content.replace(/shadow-lg shadow-black\/\[0\.03\] shadow-black\/\[0\.04\] shadow-brand\/20/g, 'shadow-brand/20');

// Empty states in news
content = content.replace(/py-20 text-center glass rounded-3xl border-dashed/g, 'py-20 text-center bg-white rounded-3xl border border-dashed border-black/[0.08] shadow-sm');

// Action buttons in tables matching new style
content = content.replace(/p-4 bg-red-500\/5 hover:bg-red-500 text-red-500 hover:text-black rounded-xl/g, 'p-4 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500 rounded-xl');
content = content.replace(/p-3 bg-red-500\/5 hover:bg-red-500 text-red-500 hover:text-black/g, 'p-3 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500');

fs.writeFileSync(file, content, 'utf8');
console.log('Admin dashboard refines 3');
