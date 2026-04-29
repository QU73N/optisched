const fs = require('fs');
const path = require('path');

function processFile(filepath) {
    try {
        let content = fs.readFileSync(filepath, 'utf-8');
        if (!content.includes('<TouchableOpacity')) return;

        if (!content.includes('AnimatedPressable')) {
            const parts = filepath.replace(/\\\\/g, '/').split('/');
            const srcIndex = parts.indexOf('src');

            let relPath = '../components/AnimatedPressable';
            if (srcIndex !== -1) {
                const depth = parts.length - srcIndex - 2;
                relPath = depth > 0 ? '../'.repeat(depth) + 'components/AnimatedPressable' : './components/AnimatedPressable';
            }

            const lines = content.split('\n');
            let lastImportIdx = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('import ')) {
                    lastImportIdx = i;
                }
            }
            if (lastImportIdx !== -1) {
                lines.splice(lastImportIdx + 1, 0, `import { AnimatedPressable } from '${relPath}';`);
                content = lines.join('\n');
            }
        }

        content = content.replace(/<TouchableOpacity/g, '<AnimatedPressable');
        content = content.replace(/<\/TouchableOpacity>/g, '</AnimatedPressable>');
        content = content.replace(/TouchableOpacity,/g, '');
        content = content.replace(/, TouchableOpacity/g, '');
        content = content.replace(/import { TouchableOpacity } from 'react-native';\r?\n/g, '');
        content = content.replace(/import {  } from 'react-native';\r?\n/g, '');

        fs.writeFileSync(filepath, content, 'utf-8');
        console.log('Updated:', filepath);
    } catch (e) {
        console.error('Error on', filepath, e);
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walk(filepath);
        } else if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
            processFile(filepath);
        }
    }
}

const srcDir = path.join(__dirname, 'src');
walk(srcDir);
console.log('Done script');
