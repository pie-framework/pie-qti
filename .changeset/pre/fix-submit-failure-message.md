---
'@pie-qti/assessment-player': patch
'@pie-qti/i18n': patch
---

A failed assessment submission now tells candidates, in their language, that their answers were not lost and they can try again, together with a support code. Backend error text is still never shown. Previously an uncoded backend or network failure fell back to a generic "Something went wrong" message, losing that reassurance.
