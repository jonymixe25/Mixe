import fs from 'fs';

const file = './src/pages/StreamView.tsx';
let content = fs.readFileSync(file, 'utf8');

// The main layout bg is dark:
//     <div className="min-h-screen bg-[#070504] text-black ...
content = content.replace(/text-black/g, 'text-white');
content = content.replace(/bg-[#070504] text-white/g, 'bg-[#070504] text-white');

// Now we need to fix any double/triple replacements
// Wait, text-black is used everywhere now.
// Let's replace 'text-white/10' style if it happened?
// We had text-black/50 -> text-white/50
// text-black/80 -> text-white/80
// text-black/40 -> text-white/40
// bg-black/[0.03] -> bg-white/5
// bg-black/[0.02] -> bg-white/5
// border-black/5 -> border-white/5
// border-black/[0.06] -> border-white/10
// text-black/30 -> text-white/30

// Let's systematically fix it
content = content.replace(/text-white/g, 'text-white');
content = content.replace(/bg-black\/\[0\.03\]/g, 'bg-white/5');
content = content.replace(/bg-black\/\[0\.02\]/g, 'bg-white/5');
content = content.replace(/border-black\/5/g, 'border-white/5');
content = content.replace(/border-black\/\[0\.06\]/g, 'border-white/10');
content = content.replace(/text-black\/50/g, 'text-white/50');
content = content.replace(/text-black\/80/g, 'text-white/80');
content = content.replace(/text-black\/40/g, 'text-white/40');
content = content.replace(/text-black\/30/g, 'text-white/30');
content = content.replace(/text-black\/90/g, 'text-white/90');
content = content.replace(/text-black\/70/g, 'text-white/70');
content = content.replace(/text-black\/10/g, 'text-white/10');

// There are a few actual backgrounds
content = content.replace(/bg-black\//g, 'bg-black/');

// text black
content = content.replace(/text-black/g, 'text-white');

// except where it meant to be black because brand button text? bg-brand text-black
content = content.replace(/bg-brand text-white/g, 'bg-brand text-black');

// Let's do bg-white to glass?
// Hmm, what about aside? bg-[#0c0a09]
content = content.replace(/bg-[#0c0a09]/g, 'bg-[#0a0a0a]');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed stream view colors');
