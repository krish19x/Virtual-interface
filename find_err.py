with open(r"G:\Github\Virtual interface\temp_check.js", "r", encoding="utf-8") as f:
    text = f.read()

# Let's check undefined variables or references
print("Total lines:", text.count("\n"))

# Check where createHumanPerson is defined
print("createHumanPerson in text:", "function createHumanPerson" in text)
print("createHumanPerson calls:", text.count("createHumanPerson"))
print("buildHumanCharacters in text:", "function buildHumanCharacters" in text)
print("updateHumanAnimations in text:", "function updateHumanAnimations" in text)
print("buildKioskStations in text:", "function buildKioskStations" in text)
