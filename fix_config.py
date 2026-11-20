html_path = r"G:\Github\Virtual interface\aadhaar_kiosk_atm_environment (4).html"
with open(html_path, "r", encoding="utf-8") as f:
    text = f.read()

# Replace function signature of createHumanPerson
old_sig = "function createHumanPerson({ x, z, rotY, height = 1.70, skinColor = 0xc68642, shirtColor = 0x2563eb, pantsColor = 0x1e293b, pose = 'standing' }) {"
new_sig = "function createHumanPerson(config) {\n    const { x, z, rotY, height = 1.70, skinColor = 0xc68642, shirtColor = 0x2563eb, pantsColor = 0x1e293b, pose = 'standing' } = config;"

if old_sig not in text:
    print("Could not find old_sig!")
    exit(1)

text = text.replace(old_sig, new_sig)

with open(html_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Fixed config error in createHumanPerson!")
