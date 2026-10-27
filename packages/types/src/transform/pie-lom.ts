/**
 * PIE item metadata in IEEE LOM
 *
 * pie-to-qti2 writes an item's `baseId` and `extensions` as LOM on the item's `<resource>` in
 * the content package manifest, so a QTI consumer that ignores the PIE source sidecar still has
 * both; to-pie reads them back when no fresh sidecar is present.
 *
 * - `baseId` is a `general/identifier` whose `catalog` is {@link PIE_LOM_BASE_ID_CATALOG}.
 * - Each `extensions` key is a `classification` whose `taxonPath/source` is
 *   {@link PIE_LOM_EXTENSION_SOURCE} followed by the key, with one taxon entry per value (per element
 *   for an array). A value other than a string also carries its JSON in the classification's `description`, so
 *   the read-back keeps its type. The classification has no `purpose`.
 * - Import also reads {@link PIE_LOM_LEGACY_EXTENSION_SOURCE}, which packages exported before the
 *   bag was named `extensions` carry.
 */

/** LOM `general/identifier/catalog` of a PIE item's `baseId`. */
export const PIE_LOM_BASE_ID_CATALOG = 'pie:baseId';

/** Prefix of the LOM `classification/taxonPath/source` of a PIE `extensions` key. */
export const PIE_LOM_EXTENSION_SOURCE = 'pie:extension:';

/** Earlier prefix of {@link PIE_LOM_EXTENSION_SOURCE}; read on import, never written. */
export const PIE_LOM_LEGACY_EXTENSION_SOURCE = 'pie:searchMetaData:';

/**
 * `curriculumStandards` and `skillLevels` travel on the item's `<resource>` in a QTI 3 package:
 *
 * - Each standard is a CSM 1.1 `labelledGUID`, under a `curriculumStandardsMetadata` per run of
 *   consecutive entries sharing a `providerId`, so document order is entry order. A standard
 *   without `providerId` goes under a `curriculumStandardsMetadata` without the attribute.
 * - A standard's `purpose` is a LOM `classification` with that `purpose`, whose `taxonPath/source` is
 *   the `providerId` and whose `taxon/id` is the GUID.
 * - Each skill level is a LOM `classification` with purpose "skill level", `taxonPath/source` the
 *   level's `source` and `taxon/id` its `id`.
 * - The PIE extensions (a standard's `primary`, `provenance` and `derivedFrom`, a skill level's
 *   `rationale`) are a `classification` without `purpose` whose `taxonPath/source` is
 *   {@link PIE_LOM_CURRICULUM_STANDARD_SOURCE} or {@link PIE_LOM_SKILL_LEVEL_SOURCE}, keyed by two
 *   taxa (`providerId` and `guid`, or `source` and `id`), with the members as a JSON object in the
 *   classification's `description`.
 * - A field written as `[]` is a `classification` whose source is
 *   {@link PIE_LOM_NONE_APPLIES_SOURCE}, with one `taxon/id` naming the field.
 */

/**
 * The issuer of a `CurriculumStandard` whose `providerId` is absent. LOM classifications name a
 * standard by this effective value.
 */
export const DEFAULT_CURRICULUM_STANDARD_PROVIDER_ID = 'AB';

/** LOM `classification/taxonPath/source` of a standard's PIE extensions. */
export const PIE_LOM_CURRICULUM_STANDARD_SOURCE = 'pie:curriculumStandard';

/** LOM `classification/taxonPath/source` of a skill level's PIE extensions. */
export const PIE_LOM_SKILL_LEVEL_SOURCE = 'pie:skillLevel';

/** LOM `classification/taxonPath/source` naming a field the writer states none applies to. */
export const PIE_LOM_NONE_APPLIES_SOURCE = 'pie:noneApplies';

/** LOM classification purpose of a skill level. */
export const LOM_SKILL_LEVEL_PURPOSE = 'skill level';

/** Namespace of QTI 3 Curriculum Standards Metadata 1.1. */
export const QTI3_CSM_NAMESPACE = 'http://www.imsglobal.org/xsd/qti/qtiv3p0/imscsmd_v1p1';
