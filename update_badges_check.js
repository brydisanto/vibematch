const fs = require('fs');

const tsFile = 'src/lib/badges.ts';
const badgesDir = 'public/badges';

let content = fs.readFileSync(tsFile, 'utf8');
const files = fs.readdirSync(badgesDir).filter(f => f.endsWith('.webp'));

const fileSet = new Set(files.map(f => '/badges/' + f));
const regex = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*image:\s*"([^"]+)",\s*tier:\s*"([^"]+)",\s*lore:\s*"([^"]+)",\s*pointMultiplier:\s*([\d.]+),?\s*\}/g;

let match;
let existingBadges = [];
while ((match = regex.exec(content)) !== null) {
  existingBadges.push({
    image: match[3]
  });
}

const referencedFiles = new Set(existingBadges.map(b => b.image));
const newFiles = files.filter(f => !referencedFiles.has('/badges/' + f));
const missingFiles = existingBadges.filter(b => !fileSet.has(b.image)).map(b => b.image);

console.log("Missing files (in TS but not in dir):", missingFiles);
console.log("New files (in dir but not in TS):", newFiles);
