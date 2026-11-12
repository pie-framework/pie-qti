---
'@pie-qti/typeset-katex': patch
---

Two robustness fixes in `typesetMathInElement`. A failed KaTeX chunk load no longer poisons the page: the rejected import promise is dropped and the next typeset pass retries, instead of every later call failing with no recovery. And the `katex-ignore-editor` exclusion class is now removed in a `finally` block — previously a `renderMathInElement` throw (possible on unexpected DOM shapes despite `throwOnError: false`) left the class on every editable region, permanently excluding all editors from future typesetting and silently stopping math rendering for the rest of the session.
