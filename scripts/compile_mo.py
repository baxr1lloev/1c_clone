import os
import struct
import sys

def generate_mo(po_file, mo_file):
    with open(po_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    messages = {}
    current_msgid = None
    current_msgstr = None
    state = None # 'id' or 'str'

    def clean(s):
        # Remove quotes around string
        s = s.strip()
        if s.startswith('"') and s.endswith('"'):
            return s[1:-1]
        return s

    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        
        if line.startswith('msgid '):
            if current_msgid is not None:
                messages[current_msgid] = current_msgstr
            current_msgid = clean(line[6:])
            current_msgstr = ""
            state = 'id'
        elif line.startswith('msgstr '):
            current_msgstr = clean(line[7:])
            state = 'str'
        elif line.startswith('"'):
            if state == 'id':
                current_msgid += clean(line)
            elif state == 'str':
                current_msgstr += clean(line)

    if current_msgid is not None:
        messages[current_msgid] = current_msgstr

    # Sort keys for binary search support (required by gettext)
    keys = sorted([k for k in messages.keys() if k != ""]) # Skip empty msgid usually header, or keep it?
    # Django uses lookups. Empty msgid might be metadata. gettext usually ignores it for lookup.
    # But usually it's the first entry.
    # Let's keep it if present.
    if "" in messages:
        keys.insert(0, "")
    
    # Actually keys should be sorted strictly?
    # gettext requires sorted original strings.
    keys = sorted(messages.keys())

    ids = b''
    strs = b''
    offsets = [] # (id_len, id_off, str_len, str_off)

    for k in keys:
        v = messages[k]
        # Unescape basic things if needed? My po file is simple. 
        # But wait, \n in po is literal \n? No, it's \\n.
        # Minimal unescape for my file:
        # I just wrote literal strings. 
        # But 'Project-Id...' header has \n.
        # My clean() function removed outer quotes but didn't decode escapes.
        
        # Simple unescape
        k = k.replace('\\n', '\n').replace('\\"', '"')
        v = v.replace('\\n', '\n').replace('\\"', '"')
        
        k_enc = k.encode('utf-8')
        v_enc = v.encode('utf-8')
        
        offsets.append((len(k_enc), len(v_enc)))
        ids += k_enc + b'\0'
        strs += v_enc + b'\0'

    # Header
    # magic(4), revision(4), nstrings(4), o_strings(4), o_trans(4), hash_size(4), hash_offset(4)
    keystart = 28 + 16 * len(keys)
    valuestart = keystart + len(ids)
    
    k_table = []
    v_table = []
    
    current_k_off = keystart
    current_v_off = valuestart
    
    # Wait, I miscalculated offsets in previous thought.
    # The table contains OFFSETS relative to file start.
    
    # ids blob starts at 'keystart'
    # strs blob starts at 'valuestart'
    
    # We need to track accumulation
    acc_id_len = 0
    acc_str_len = 0
    
    for i in range(len(keys)):
        k_len, v_len = offsets[i]
        
        k_table.extend([k_len, keystart + acc_id_len])
        v_table.extend([v_len, valuestart + acc_str_len])
        
        acc_id_len += k_len + 1 # +1 for null
        acc_str_len += v_len + 1

    header = struct.pack('Iiiiiii',
                         0x950412de,        # Magic
                         0,                 # Revision
                         len(keys),         # N strings
                         28,                # Offset to string table
                         28 + 8 * len(keys),# Offset to trans table
                         0, 0               # Hash table size, offset
                         )
    
    with open(mo_file, 'wb') as f:
        f.write(header)
        f.write(struct.pack(f'{len(k_table)}i', *k_table))
        f.write(struct.pack(f'{len(v_table)}i', *v_table))
        f.write(ids)
        f.write(strs)
        
    print(f"Compiled {po_file} -> {mo_file} ({len(keys)} messages)")

def main():
    base_dir = os.getcwd()
    locale_dir = os.path.join(base_dir, 'locale')
    if not os.path.exists(locale_dir):
        print("locale directory not found")
        return

    for lang in os.listdir(locale_dir):
        lc_msgs = os.path.join(locale_dir, lang, 'LC_MESSAGES')
        if os.path.isdir(lc_msgs):
            po_path = os.path.join(lc_msgs, 'django.po')
            mo_path = os.path.join(lc_msgs, 'django.mo')
            if os.path.exists(po_path):
                try:
                    generate_mo(po_path, mo_path)
                except Exception as e:
                    print(f"Error compiling {po_path}: {e}")

if __name__ == '__main__':
    main()
