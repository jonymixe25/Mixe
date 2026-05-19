import fs from 'fs';

const file = './src/pages/AdminStream.tsx';
let content = fs.readFileSync(file, 'utf8');

// Admin stream has bg-[#070504] text-black
content = content.replace(/bg-\[#070504\] text-black/g, 'bg-[#070504] text-white');
content = content.replace(/text-black\/90/g, 'text-white/90');
content = content.replace(/text-black\/50/g, 'text-white/50');
content = content.replace(/text-black\/30/g, 'text-white/30');
content = content.replace(/text-black\/40/g, 'text-white/40');
content = content.replace(/text-black\/10/g, 'text-white/10');
content = content.replace(/text-black\/70/g, 'text-white/70');
content = content.replace(/bg-black\/\[0\.02\]/g, 'bg-white/5');
content = content.replace(/bg-black\/\[0\.03\]/g, 'bg-white/5');
content = content.replace(/bg-black\/\[0\.06\]/g, 'bg-white/10');
content = content.replace(/border-black\/\[0\.04\]/g, 'border-white/10');
content = content.replace(/border-black\/\[0\.06\]/g, 'border-white/10');
content = content.replace(/border-black\/5/g, 'border-white/5');
content = content.replace(/text-black/g, 'text-white');
content = content.replace(/bg-white rounded-3xl/g, 'bg-[#0a0a0a] rounded-3xl border-white/5 shadow-none');
content = content.replace(/glass/g, 'bg-[#0a0a0a] border-white/10');
content = content.replace(/bg-white border-dashed/g, 'bg-white/5 border-dashed border-white/10');

// fix buttons with text-white inside brand
content = content.replace(/bg-brand text-white/g, 'bg-brand text-black');
content = content.replace(/bg-brand\/90 text-white/g, 'bg-brand/90 text-black');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed admin stream colors');
