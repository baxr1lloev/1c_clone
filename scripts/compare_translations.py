import json
import os
import sys

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_keys(obj, prefix=''):
    keys = set()
    for k, v in obj.items():
        if isinstance(v, dict):
            keys.update(get_keys(v, prefix + k + '.'))
        else:
            keys.add(prefix + k)
    return keys

def compare_translations(base_path, locales=['en', 'ru', 'uz']):
    data = {}
    all_keys = set()
    
    for locale in locales:
        path = os.path.join(base_path, f'{locale}.json')
        if os.path.exists(path):
            json_data = load_json(path)
            data[locale] = json_data
            keys = get_keys(json_data)
            all_keys.update(keys)
            print(f"Loaded {locale}: {len(keys)} keys")
        else:
            print(f"File not found: {path}")
            return

    missing = {l: [] for l in locales}
    
    for key in sorted(all_keys):
        for locale in locales:
            parts = key.split('.')
            current = data.get(locale, {})
            found = True
            for part in parts:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    found = False
                    break
            
            if not found:
                missing[locale].append(key)

    for locale in locales:
        if missing[locale]:
            print(f"\nMissing in {locale} ({len(missing[locale])} keys):")
            for k in missing[locale]:
                print(f"  {k}")
        else:
            print(f"\nNo missing keys in {locale}")

if __name__ == "__main__":
    base_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    compare_translations(base_dir)
