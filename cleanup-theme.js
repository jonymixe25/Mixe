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
  content = content.replace(/via-\[#0a0502\]/g, 'via-[#f5f5f0]');
  content = content.replace(/to-\[#0a0502\]/g, 'to-[#f5f5f0]');
  content = content.replace(/from-\[#0a0502\]/g, 'from-[#f5f5f0]');
  content = content.replace(/bg-red-600/g, 'bg-rose-500'); // make warnings slightly softer
  
  fs.writeFileSync(file, content, 'utf8');
});

console.log('Cleanup script done');
