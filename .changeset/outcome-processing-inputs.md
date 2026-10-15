---
'@pie-qti/assessment-player': patch
'@pie-qti/item-player': patch
'@pie-qti/qti-processing': patch
'@pie-qti/player-elements': patch
---

Test-level outcome processing sees every delivered item with its typed variables, section path, categories, weights, declared normal bounds and presented/responded/correct/incorrect/selected flags, so `numberResponded`, `numberSelected`, `numberCorrect` without `MAXSCORE`, section and category filters and weighted `testVariables` evaluate as authored. Item scoring reports `correct`; `outcomeMinimum`/`outcomeMaximum` read `normalMinimum`/`normalMaximum`.
