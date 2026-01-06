/**
 * IMS Content Package Validation
 *
 * Validates the structure and integrity of IMS Content Packages
 */

import type { ManifestInput } from '../types/manifest.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  location?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  location?: string;
}

/**
 * Validate manifest input structure
 */
export function validateManifestInput(input: ManifestInput): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate items
  if (!input.items || input.items.length === 0) {
    errors.push({
      code: 'NO_ITEMS',
      message: 'Manifest must contain at least one item',
    });
  } else {
    // Check for duplicate item IDs
    const itemIds = new Set<string>();
    for (const item of input.items) {
      if (!item.id) {
        errors.push({
          code: 'MISSING_ITEM_ID',
          message: 'Item is missing required id property',
          location: `items[${input.items.indexOf(item)}]`,
        });
      } else if (itemIds.has(item.id)) {
        errors.push({
          code: 'DUPLICATE_ITEM_ID',
          message: `Duplicate item ID: ${item.id}`,
          location: `items[${input.items.indexOf(item)}]`,
        });
      } else {
        itemIds.add(item.id);
      }

      if (!item.filePath) {
        errors.push({
          code: 'MISSING_ITEM_PATH',
          message: `Item '${item.id}' is missing required filePath`,
          location: `items[${input.items.indexOf(item)}]`,
        });
      }
    }
  }

  // Validate passages
  if (input.passages && input.passages.length > 0) {
    const passageIds = new Set<string>();

    for (const passage of input.passages) {
      if (!passage.id) {
        errors.push({
          code: 'MISSING_PASSAGE_ID',
          message: 'Passage is missing required id property',
          location: `passages[${input.passages.indexOf(passage)}]`,
        });
      } else if (passageIds.has(passage.id)) {
        errors.push({
          code: 'DUPLICATE_PASSAGE_ID',
          message: `Duplicate passage ID: ${passage.id}`,
          location: `passages[${input.passages.indexOf(passage)}]`,
        });
      } else {
        passageIds.add(passage.id);
      }

      if (!passage.filePath) {
        errors.push({
          code: 'MISSING_PASSAGE_PATH',
          message: `Passage '${passage.id}' is missing required filePath`,
          location: `passages[${input.passages.indexOf(passage)}]`,
        });
      }
    }

    // Validate passage dependencies
    if (input.items) {
      for (const item of input.items) {
        if (item.dependencies && item.dependencies.length > 0) {
          for (const depId of item.dependencies) {
            if (!passageIds.has(depId)) {
              errors.push({
                code: 'MISSING_PASSAGE_DEPENDENCY',
                message: `Item '${item.id}' references non-existent passage '${depId}'`,
                location: `items[${input.items.indexOf(item)}].dependencies`,
              });
            }
          }
        }
      }
    }
  } else {
    // Check if any items reference passages
    if (input.items) {
      for (const item of input.items) {
        if (item.dependencies && item.dependencies.length > 0) {
          errors.push({
            code: 'MISSING_PASSAGES',
            message: `Item '${item.id}' references passages but no passages are defined`,
            location: `items[${input.items.indexOf(item)}].dependencies`,
          });
        }
      }
    }
  }

  // Validate assessments
  if (input.assessments && input.assessments.length > 0) {
    const assessmentIds = new Set<string>();
    const itemIds = new Set(input.items?.map(i => i.id) || []);

    for (const assessment of input.assessments) {
      if (!assessment.id) {
        errors.push({
          code: 'MISSING_ASSESSMENT_ID',
          message: 'Assessment is missing required id property',
          location: `assessments[${input.assessments.indexOf(assessment)}]`,
        });
      } else if (assessmentIds.has(assessment.id)) {
        errors.push({
          code: 'DUPLICATE_ASSESSMENT_ID',
          message: `Duplicate assessment ID: ${assessment.id}`,
          location: `assessments[${input.assessments.indexOf(assessment)}]`,
        });
      } else {
        assessmentIds.add(assessment.id);
      }

      if (!assessment.filePath) {
        errors.push({
          code: 'MISSING_ASSESSMENT_PATH',
          message: `Assessment '${assessment.id}' is missing required filePath`,
          location: `assessments[${input.assessments.indexOf(assessment)}]`,
        });
      }

      // Validate item dependencies
      if (assessment.dependencies && assessment.dependencies.length > 0) {
        for (const depId of assessment.dependencies) {
          if (!itemIds.has(depId)) {
            errors.push({
              code: 'MISSING_ITEM_DEPENDENCY',
              message: `Assessment '${assessment.id}' references non-existent item '${depId}'`,
              location: `assessments[${input.assessments.indexOf(assessment)}].dependencies`,
            });
          }
        }
      } else {
        warnings.push({
          code: 'ASSESSMENT_NO_ITEMS',
          message: `Assessment '${assessment.id}' has no item dependencies`,
          location: `assessments[${input.assessments.indexOf(assessment)}]`,
        });
      }
    }
  }

  // Validate package ID format
  if (input.options?.packageId) {
    const pkgId = input.options.packageId;
    // IMS CP identifiers should not contain spaces or special chars
    if (/[\s<>"&']/.test(pkgId)) {
      warnings.push({
        code: 'INVALID_PACKAGE_ID_CHARS',
        message: `Package ID '${pkgId}' contains invalid characters (spaces or special chars)`,
        location: 'options.packageId',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate generated manifest structure
 */
export function validateGeneratedManifest(manifestXml: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Basic XML structure checks
  if (!manifestXml.includes('<?xml version="1.0"')) {
    errors.push({
      code: 'MISSING_XML_DECLARATION',
      message: 'Manifest is missing XML declaration',
    });
  }

  if (!manifestXml.includes('<manifest')) {
    errors.push({
      code: 'MISSING_MANIFEST_ROOT',
      message: 'Manifest is missing root <manifest> element',
    });
  }

  // Check required namespaces
  const requiredNamespaces = [
    'xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"',
    'xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p2"',
  ];

  for (const ns of requiredNamespaces) {
    if (!manifestXml.includes(ns)) {
      errors.push({
        code: 'MISSING_NAMESPACE',
        message: `Manifest is missing required namespace: ${ns}`,
      });
    }
  }

  // Check for organizations element
  if (!manifestXml.includes('<organizations')) {
    errors.push({
      code: 'MISSING_ORGANIZATIONS',
      message: 'Manifest is missing required <organizations> element',
    });
  }

  // Check for resources element
  if (!manifestXml.includes('<resources>')) {
    errors.push({
      code: 'MISSING_RESOURCES',
      message: 'Manifest is missing required <resources> element',
    });
  }

  // Check for at least one resource
  if (!manifestXml.includes('<resource ')) {
    warnings.push({
      code: 'NO_RESOURCES',
      message: 'Manifest contains no resources',
    });
  }

  // Check resource types
  const hasItemResources = manifestXml.includes('type="imsqti_item_xmlv2p2"');
  const hasAssessmentResources = manifestXml.includes('type="imsqti_assessment_xmlv2p2"');

  if (!hasItemResources && !hasAssessmentResources) {
    warnings.push({
      code: 'NO_QTI_RESOURCES',
      message: 'Manifest contains no QTI item or assessment resources',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Comprehensive validation of manifest input and generated output
 */
export function validatePackage(input: ManifestInput): ValidationResult {
  // Validate input structure
  const inputValidation = validateManifestInput(input);

  if (!inputValidation.valid) {
    return inputValidation;
  }

  // Generate manifest and validate output
  try {
    const { generateManifest } = require('../generators/manifest-generator.js');
    const manifestXml = generateManifest(input);
    const outputValidation = validateGeneratedManifest(manifestXml);

    return {
      valid: outputValidation.valid,
      errors: [...inputValidation.errors, ...outputValidation.errors],
      warnings: [...inputValidation.warnings, ...outputValidation.warnings],
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          code: 'GENERATION_ERROR',
          message: `Failed to generate manifest: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      warnings: inputValidation.warnings,
    };
  }
}
