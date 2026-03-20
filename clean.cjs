const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.gemini') continue;
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      walkSync(filepath, filelist);
    } else {
      if (filepath.endsWith('.js') || filepath.endsWith('.html') || filepath.endsWith('.css')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

const files = walkSync(__dirname);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Remove emojis using unicode property escapes
  content = content.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, '');
  content = content.replace(/[\u26A0\uFE0F]/g, ''); // Warning and variation selector
  
  // Remove [FIX...], [BUG...] prefixes in comments
  content = content.replace(/\/\/\s*\[(?:FIX|BUG)[a-zA-Z0-9\-_]*\]\s*/gi, '// ');
  content = content.replace(/\/\*\s*\[(?:FIX|BUG)[a-zA-Z0-9\-_]*\]\s*/gi, '/* ');
  content = content.replace(/\/\/\s*FIX:\s*/gi, '// ');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Cleaned: ' + file);
  }
}
console.log('Done!');
