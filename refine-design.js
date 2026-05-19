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

  // Refine overly bubbly corners to elegant curves
  content = content.replace(/rounded-\[3rem\]/g, 'rounded-3xl');
  content = content.replace(/rounded-\[2\.5rem\]/g, 'rounded-3xl');
  content = content.replace(/rounded-\[2rem\]/g, 'rounded-3xl');
  content = content.replace(/rounded-2xl/g, 'rounded-xl');
  
  // Refine heavy shadows
  content = content.replace(/shadow-2xl shadow-black\/50/g, 'shadow-xl shadow-black/[0.02]');
  content = content.replace(/shadow-2xl/g, 'shadow-xl shadow-black/[0.04]');
  content = content.replace(/shadow-xl/g, 'shadow-lg shadow-black/[0.03]');

  // Refine aggressive uppercase text
  content = content.replace(/font-black uppercase tracking-widest/g, 'font-semibold uppercase tracking-wider');
  content = content.replace(/font-black uppercase tracking-\[0\.4em\]/g, 'font-semibold uppercase tracking-[0.2em]');
  content = content.replace(/font-black uppercase tracking-\[0\.3em\]/g, 'font-semibold uppercase tracking-[0.15em]');
  content = content.replace(/font-black uppercase tracking-\[0\.2em\]/g, 'font-semibold uppercase tracking-[0.15em]');
  content = content.replace(/font-black tracking-tighter uppercase italic/g, 'font-bold tracking-tight text-black/90');
  content = content.replace(/font-black tracking-tighter uppercase/g, 'font-bold tracking-tight text-black/90');
  
  // Replace font-black with font-bold or font-semibold globally
  content = content.replace(/font-black/g, 'font-bold');

  // Refine borders and colors
  content = content.replace(/border-black\/10/g, 'border-black/[0.06]');
  content = content.replace(/border-brand\/30/g, 'border-brand/20');
  content = content.replace(/bg-black\/5/g, 'bg-black/[0.03]');
  content = content.replace(/bg-black\/10/g, 'bg-black/[0.06]');

  fs.writeFileSync(file, content, 'utf8');
});
console.log('Refinement complete');
