---
'@pie-qti/assessment-player': patch
'@pie-qti/ims-cp-node': patch
'@pie-qti/item-player': patch
---

Generate identifiers from a CSPRNG and fix a non-uniform shuffle.

- `item-player`: `createSessionGuid` previously fell back to `Math.random()` when
  `crypto.randomUUID` was unavailable — which is precisely the case when the player is
  served over plain HTTP, since `randomUUID` is restricted to secure contexts. It now
  falls back to `crypto.getRandomValues`, and throws a descriptive error if no Web Crypto
  API is present at all rather than silently producing predictable session GUIDs.
- `ims-cp-node`: temporary extraction directories are now created with `fs.mkdtemp`
  instead of a `Date.now()` + `Math.random()` name. The old name was predictable and was
  built before the directory was created, so a local attacker could pre-create the path or
  plant a symlink there. `mkdtemp` creates the directory atomically with mode `0700`
  (previously `0755`, i.e. readable by other local users).
- `assessment-player`: `ReferenceBackendAdapter` item-bank selection used
  `sort(() => Math.random() - 0.5)`, which is not a uniform shuffle — measured over 60k
  trials it left the first element in place 21.9% of the time against an expected 16.7%.
  Replaced with the Fisher-Yates helper already used by `AssessmentPlayer`.
