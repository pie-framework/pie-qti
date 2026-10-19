---
"@pie-qti/section-player": patch
---

Move to pie-players 1.0.0-beta.3. The TTS provider config takes the 1.0 shape (`backend`, `serverProvider` and top-level settings), with the pre-1.0 `provider` string, `settings` and `validateEndpoint` keys mapped onto it, and the calculator type now reaches the calculator through the item scope's tool parameters. The readable interaction projection is gone: the 1.0 reader reads interactions from their own shadow content, which it would otherwise read twice.
