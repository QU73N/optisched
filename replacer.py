import os

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        if '<TouchableOpacity' not in content:
            return

        if 'AnimatedPressable' not in content:
            # Add import correctly
            parts = filepath.replace('\\', '/').split('/')
            try:
                src_index = parts.index('src')
                depth = len(parts) - src_index - 2
                rel_path = '../' * depth + 'components/AnimatedPressable' if depth > 0 else './components/AnimatedPressable'
            except ValueError:
                rel_path = '../components/AnimatedPressable'

            lines = content.split('\n')
            last_import_idx = -1
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    last_import_idx = i
            
            if last_import_idx != -1:
                lines.insert(last_import_idx + 1, f"import {{ AnimatedPressable }} from '{rel_path}';")
                content = '\n'.join(lines)

        content = content.replace('<TouchableOpacity', '<AnimatedPressable')
        content = content.replace('</TouchableOpacity>', '</AnimatedPressable>')
        content = content.replace('TouchableOpacity,', '')
        content = content.replace(', TouchableOpacity', '')
        content = content.replace("import { TouchableOpacity } from 'react-native';\n", "")
        content = content.replace("import {  } from 'react-native';\n", "")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated:", filepath)
    except Exception as e:
        print(f"Error on {filepath}:", e)

src_dir = os.path.join(os.getcwd(), 'src')
for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))

print("Done")
