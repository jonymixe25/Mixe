import fs from 'fs';
import path from 'path';

const file = './src/pages/StreamView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Apply elegant refinements
content = content.replace(/className="min-h-screen bg-white text-black"\s*>\s*<div className="absolute inset-0 z-0 opacity-[0\.02]"\s*style={{ backgroundImage: `url\('\/noise\.png'\)` }}\/?>\s*<div className="absolute inset-0 z-0 bg-\[radial-gradient\(circle_at_50%_0%,#000000_0%,transparent_70%\)\]" \/>/g, 'className="min-h-screen bg-black/5 text-black">');

// Header
content = content.replace(/className="text-white\/50 hover:text-white transition-colors"/g, 'className="text-black/50 hover:text-black transition-colors"');
content = content.replace(/className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight flex items-center gap-4"/g, 'className="text-4xl md:text-5xl font-display font-bold text-black tracking-tight flex items-center gap-4"');
content = content.replace(/bg-red-500\/20 text-red-500/g, 'bg-rose-500/10 text-rose-500');

// Main layout parts
content = content.replace(/className="glass rounded-3xl p-6 md:p-8 border-white\/5"/g, 'className="bg-white rounded-3xl p-6 md:p-8 border border-black/[0.04] shadow-sm"');
content = content.replace(/className="lg:col-span-2 space-y-6"/g, 'className="lg:col-span-2 space-y-6"');
content = content.replace(/className="w-full aspect-video bg-black\/50 rounded-2xl border border-white\/5 shadow-2xl overflow-hidden relative group"/g, 'className="w-full aspect-video bg-black rounded-2xl shadow-xl overflow-hidden relative group"');

// Chat container
content = content.replace(/className="h-\[600px\] lg:h-auto glass rounded-3xl border-white\/5 flex flex-col relative overflow-hidden"/g, 'className="h-[600px] lg:h-auto bg-white rounded-3xl border border-black/[0.04] shadow-sm flex flex-col relative overflow-hidden"');
content = content.replace(/className="p-6 border-b border-white\/5"/g, 'className="p-6 border-b border-black/[0.04]"');
content = content.replace(/className="text-xl font-display font-bold text-white flex items-center gap-3"/g, 'className="text-xl font-display font-bold text-black flex items-center gap-3"');
content = content.replace(/className="w-6 h-6 text-brand"/g, 'className="w-6 h-6 text-brand"');

// Chat messages
content = content.replace(/className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"/g, 'className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"');
content = content.replace(/className={`p-4 rounded-2xl inline-block max-w-\[85%\] \${/g, 'className={`p-4 rounded-xl inline-block max-w-[85%] border shadow-sm ${');

// Action buttons
content = content.replace(/className="p-4 bg-brand hover:bg-[#ff4e00] text-black rounded-xl transition-all shadow-lg shadow-brand\/20 flex items-center justify-center"/g, 'className="p-4 bg-brand hover:bg-brand/90 text-white rounded-xl transition-all shadow-md shadow-brand/20 flex items-center justify-center shrink-0"');

// Glass replacements
content = content.replace(/glass/g, 'bg-white');
content = content.replace(/border-white\/10/g, 'border-black/[0.04]');
content = content.replace(/border-white\/5/g, 'border-black/[0.04]');
content = content.replace(/text-white\/80/g, 'text-black/80');
content = content.replace(/text-white\/50/g, 'text-black/50');
content = content.replace(/text-white/g, 'text-black');
content = content.replace(/bg-black\/50/g, 'bg-black/[0.03]');
content = content.replace(/bg-black\/40/g, 'bg-black/[0.02]');

fs.writeFileSync(file, content, 'utf8');

const file2 = './src/pages/AdminStream.tsx';
let content2 = fs.readFileSync(file2, 'utf8');

// Header
content2 = content2.replace(/className="text-5xl md:text-6xl font-display font-bold tracking-tight text-black\/90"/g, 'className="text-4xl md:text-5xl font-display font-bold tracking-tight text-black flex items-center gap-4"');

// Action buttons
content2 = content2.replace(/className="w-full bg-brand text-black px-10 py-5 rounded-xl font-semibold uppercase tracking-wider/g, 'className="w-full bg-brand text-white px-10 py-5 rounded-xl font-semibold uppercase tracking-wider shadow-md');

// Refine other properties
content2 = content2.replace(/bg-white rounded-3xl p-8 border-black\/\[0\.04\]/g, 'bg-white rounded-3xl p-8 border border-black/[0.04] shadow-sm');
content2 = content2.replace(/border border-black\/\[0\.04\] p-6 rounded-3xl/g, 'bg-white p-6 rounded-2xl border border-black/[0.04] shadow-sm');
content2 = content2.replace(/border-dashed border-black\/\[0\.06\]/g, 'border border-dashed border-black/[0.08]');
content2 = content2.replace(/bg-black\/\[0\.03\] border-black\/\[0\.06\]/g, 'bg-black/[0.02] border border-black/[0.04]');

fs.writeFileSync(file2, content2, 'utf8');
console.log('Stream refinement complete');
