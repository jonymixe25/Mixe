const fs = require('fs');
const path = require('path');

const target = '#f5f5f0';
const replacement = '#fcf9f9';

function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== '.vite' && file !== 'dist' && file !== 'public') {
                walk(filePath);
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css') || file.endsWith('.js')) {
            let content = fs.readFileSync(filePath, 'utf8');
            if (content.includes(target)) {
                content = content.replace(new RegExp(target.replace('#', '\\#'), 'g'), replacement);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log('Updated:', filePath);
            }
        }
    });
}

walk('./src');
walk('./');
