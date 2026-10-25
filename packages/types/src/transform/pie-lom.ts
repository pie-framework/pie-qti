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
