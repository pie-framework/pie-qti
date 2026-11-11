---
'@pie-qti/transform-core': major
---

Breaking: removed the dead utilities module — a 360-line public API whose only consumers were its own tests and docs. Deleted `src/utils/errors.ts` and `src/utils/validator.ts` with everything they exported from the package root:

- Error helpers: `createError`, `CreateErrorOptions`, `createValidationError`, `createConfigurationError`, `createInternalError`, `createExternalError`, `shouldRetry`, `shouldShowToUser`, `shouldNotifyOps`, `getSuggestedAction`, `wrapError`, `formatError`, `isValidationError`, `isConfigurationError`, `isInternalError`, `isExternalError`. Error handling goes through `TransformError`/`ErrorCategory` from `@pie-qti/transform-types` directly, as it already did everywhere in-repo.
- PIE item validation: `PieItemValidator`, `validatePieItemStructure`, `DetailedValidationResult`, `ValidationError`. The class had no caller outside its own tests (and the engine's activities construct their own errors), so the validation surface validated nothing real; `packages/schemas` remains the schema home (see the `@pie-qti/element-schemas` changeset for its corrected contract).

Also removed with them: the `VALIDATION.md` doc (it documented only the deleted validator plus a `--validate` CLI flag that does not exist), the Validation section in the package README, and the now-unused `@pie-qti/element-schemas` and `ajv` dependencies. Transform behavior is unchanged.
