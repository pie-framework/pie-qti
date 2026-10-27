---
"@pie-qti/transform-types": minor
"@pie-qti/pie-to-qti2": minor
"@pie-qti/to-pie": minor
---

PIE items and passages take optional `curriculumStandards` and `skillLevels`, where `[]` states that none applies. A QTI 3 package carries an item's standards as Curriculum Standards Metadata 1.1 and both fields as LOM classifications, so to-pie reads them back unchanged without the sidecar and reads standards and skill levels from foreign QTI 3 packages; QTI 2.2 packages carry them in the sidecar only. A standard without `providerId` means Academic Benchmarks and keeps the attribute absent through the round trip.
