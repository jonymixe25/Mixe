import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Safe swaps to avoid double replacements
  // 1. Temporarily replace text-black and bg-white with placeholders
  content = content.replace(/text-black/g, 'TEXT_BLACK_PLACEHOLDER');
  content = content.replace(/bg-white/g, 'BG_WHITE_PLACEHOLDER');
  
  // 2. Replace dark mode utilities to light mode
  content = content.replace(/bg-\[#0a0502\]/g, 'bg-[#f5f5f0]');
  content = content.replace(/text-white\/20/g, 'text-black/30');
  content = content.replace(/text-white\/30/g, 'text-black/40');
  content = content.replace(/text-white\/40/g, 'text-black/50');
  content = content.replace(/text-white\/60/g, 'text-black/60');
  content = content.replace(/text-white\/80/g, 'text-black/80');
  content = content.replace(/text-white/g, 'text-black');
  
  content = content.replace(/bg-white\/5/g, 'bg-black/5');
  content = content.replace(/bg-white\/10/g, 'bg-black/10');
  content = content.replace(/bg-white\/20/g, 'bg-black/20');
  content = content.replace(/bg-white\/30/g, 'bg-black/30');
  
  content = content.replace(/border-white\/5/g, 'border-black/5');
  content = content.replace(/border-white\/10/g, 'border-black/10');
  content = content.replace(/border-white\/20/g, 'border-black/20');
  content = content.replace(/border-white\/30/g, 'border-black/30');
  
  content = content.replace(/shadow-white\/5/g, 'shadow-black/5');
  content = content.replace(/shadow-white\/10/g, 'shadow-black/10');
  
  // 3. Restore placeholders, but flip them to their dark equivalents
  content = content.replace(/TEXT_BLACK_PLACEHOLDER/g, 'text-white');
  content = content.replace(/BG_WHITE_PLACEHOLDER/g, 'bg-black');
  
  // 4. Update hardcoded orange colors to generic brand variable
  content = content.replace(/text-\[#ff4e00\]/g, 'text-brand');
  content = content.replace(/bg-\[#ff4e00\]/g, 'bg-brand');
  content = content.replace(/border-\[#ff4e00\]/g, 'border-brand');
  
  fs.writeFileSync(file, content, 'utf8');
});

console.log('Theme toggle script completed effectively.');
