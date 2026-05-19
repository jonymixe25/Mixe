import fs from 'fs';
import path from 'path';

const file = './src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The main alert button had text-black instead of text-white
content = content.replace(/w-full bg-rose-500 text-black px-10 py-5/g, 'w-full bg-rose-500 text-white px-10 py-5');

// Additional UI refinements on tables
content = content.replace(/bg-black\/\[0\.02\] border-black\/\[0\.04\]/g, 'bg-black/[0.02] border border-black/[0.04]');
content = content.replace(/border border-black\/\[0\.04\] shadow-sm shadow-lg shadow-black\/\[0\.03\] shadow-black\/\[0\.04\]/g, 'border border-black/[0.04] shadow-sm');
content = content.replace(/shadow-sm shadow-lg shadow-black\/\[0\.03\]/g, 'shadow-sm');

// Alert history icons
content = content.replace(/bg-red-500\/20 text-red-500/g, 'bg-rose-500/10 text-rose-500');
content = content.replace(/border-red-500\/20/g, 'border-rose-500/20');
content = content.replace(/bg-red-500\/5 hover:bg-red-500/g, 'bg-rose-500/5 hover:bg-rose-500');
content = content.replace(/text-red-500/g, 'text-rose-500');

// "En vivo" indicator style refinements
content = content.replace(/bg-red-500\/10 text-red-500/g, 'bg-rose-500/10 text-rose-500');
content = content.replace(/bg-red-500/g, 'bg-rose-500');

fs.writeFileSync(file, content, 'utf8');
console.log('Admin dashboard patch complete');
