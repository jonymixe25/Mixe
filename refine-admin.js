import fs from 'fs';
import path from 'path';

const file = './src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Header section refinements
content = content.replace(/text-5xl md:text-6xl font-display font-bold tracking-tight text-black\/90/g, 'text-4xl md:text-5xl font-display font-bold tracking-tight text-black flex items-center gap-4');
content = content.replace(/border-brand\/20 bg-brand\/5 hover:bg-brand\/10 text-brand/g, 'bg-brand text-white hover:opacity-90 border-transparent shadow-md shadow-brand/20');
content = content.replace(/<Wifi className="w-3 h-3" \/>/g, '<Wifi className="w-4 h-4" />');

// Tabs refinement
content = content.replace(/class="flex glass p-1\.5 rounded-xl border-black\/\[0\.06\] shadow-lg shadow-black\/\[0\.03\]/g, 'className="flex bg-black/[0.03] p-1.5 rounded-2xl border border-black/5 overflow-x-auto custom-scrollbar');
content = content.replace(/bg-brand text-black shadow-lg shadow-\[#ff4e00\]\/20/g, 'bg-white text-black shadow-sm');
content = content.replace(/text-black\/50 hover:text-black hover:bg-black\/\[0\.03\]/g, 'text-black/50 hover:text-black hover:bg-white/50');
content = content.replace(/px-8 py-2\.5 rounded-xl/g, 'px-6 py-2.5 rounded-[10px]');
content = content.replace(/<div className="flex glass p-1\.5/g, '<div className="flex bg-black/[0.02] p-1.5');
content = content.replace(/shadow-\[#ff4e00\]\/20/g, 'shadow-brand/20');

// Stats cards
content = content.replace(/className="glass rounded-3xl p-8 flex items-center justify-between group/g, 'className="bg-white rounded-3xl p-8 flex items-center justify-between group border border-black/[0.04] shadow-sm');
content = content.replace(/shadow-inner/g, '');

// Table container
content = content.replace(/className="glass rounded-3xl overflow-hidden/g, 'className="bg-white rounded-3xl overflow-hidden border border-black/[0.04] shadow-sm');

// Table styling
content = content.replace(/bg-black\/\[0\.03\]/g, 'bg-black/[0.02]');
content = content.replace(/divide-white\/5/g, 'divide-black/[0.04]');
content = content.replace(/border-black\/\[0\.06\]/g, 'border-black/[0.04]');

fs.writeFileSync(file, content, 'utf8');
console.log('Admin dashboard refined');
