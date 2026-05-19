import fs from 'fs';

const file = './src/pages/StreamView.tsx';
let content = fs.readFileSync(file, 'utf8');

// The main layout bg is dark:
//     <div className="min-h-screen bg-[#070504] text-black ...

content = content.replace(/hover:bg-black\/\[0\.06\]/g, 'hover:bg-white/10');
content = content.replace(/bg-black\/\[0\.06\]/g, 'bg-white/10');
content = content.replace(/hover:bg-black\/\[0\.03\]/g, 'hover:bg-white/5');
content = content.replace(/bg-black\/\[0\.03\]/g, 'bg-white/5');
content = content.replace(/bg-black\/\[0\.02\]/g, 'bg-white/[0.02]');
content = content.replace(/border-black\/5/g, 'border-white/5');
content = content.replace(/bg-black\/2/g, 'bg-white/[0.02]');
content = content.replace(/border-black\/\[0\.06\]/g, 'border-white/10');

// There are a few other off colors
content = content.replace(/text-black/g, 'text-black'); // wait, we already changed this to text-white earlier, let me just replace any remaining text-black except brand button
content = content.replace(/text-black\/50/g, 'text-white/50');
content = content.replace(/text-black\/30/g, 'text-white/30');

// Also bg-[#0c0a09] to bg-[#0a0a0a]
content = content.replace(/bg-\[#0c0a09\]/g, 'bg-[#0a0a0a]');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed stream view colors again');
