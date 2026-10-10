/**
 * PIE item metadata in IEEE LOM
 *
 * pie-to-qti2 writes an item's `baseId` and `searchMetaData` as LOM on the item's `<resource>` in
 * the content package manifest, so a QTI consumer that ignores the PIE source sidecar still has
 * both; to-pie reads them back when no fresh sidecar is present.
 *
 * - `baseId` is a `general/identifier` whose `catalog` is {@link PIE_LOM_BASE_ID_CATALOG}.
 * - Each `searchMetaData` key is a `classification` whose `taxonPath/source` is
 *   {@link PIE_LOM_SEARCH_METADATA_SOURCE} followed by the key, with one taxon entry per value. A
 *   value other than a string also carries its JSON in the classification's `description`, so the
 *   read-back keeps its type.
 */

/** LOM `general/identifier/catalog` of a PIE item's `baseId`. */
export const PIE_LOM_BASE_ID_CATALOG = 'pie:baseId';

/** Prefix of the LOM `classification/taxonPath/source` of a PIE `searchMetaData` key. */
export const PIE_LOM_SEARCH_METADATA_SOURCE = 'pie:searchMetaData:';
