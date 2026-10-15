---
'@pie-qti/qti-common': patch
'@pie-qti/to-pie': patch
'@pie-qti/item-player': patch
'@pie-qti/section-player': patch
'@pie-qti/player-elements': patch
---

Content language follows `xml:lang`. `prepareContentMarkup` restates it as `lang`; the item body takes its `lang` from the item, exposed as `Player.getContentLanguage()`, and glossary lookups pass it. The section player sets the toolbar and TTS language from it and picks a Polly voice for that language unless the host configures `defaultVoice`, which no longer defaults to Joanna; shared HTML blocks take an optional `language`.
