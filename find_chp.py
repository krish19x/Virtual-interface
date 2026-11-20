with open(r"G:\Github\Virtual interface\temp_check.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "createHumanPerson" in l:
        print(f"Line {i+1}: {l.strip()[:80]}")
