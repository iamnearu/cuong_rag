import os
import re

for root, dirs, files in os.walk('c:/Users/cuong/cuong_rag'):
    if 'venv' in root or '.git' in root or '__pycache__' in root or 'node_modules' in root:
        continue
    for f in files:
        if f.endswith('.py') and ('api' in root or 'routes' in root):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
                matches = re.findall(r'@(?:router|app)\.(get|post|put|delete|patch)\(.*?(?:\"|\')(.*?)(?:\"|\').*?\)\s*async def (.*?)\(', content, re.DOTALL)
                if matches:
                    print(f'\n--- {path} ---')
                    for method, route, func in matches:
                        print(f'{method.upper()} {route} -> {func}')
