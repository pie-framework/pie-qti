# IMS Content Packages: Complete Technical Documentation

The IMS Content Packaging (IMS CP) specification provides the foundational framework for exchanging e-learning content between authoring tools, learning management systems, and digital repositories. Developed by IMS Global Learning Consortium (now 1EdTech), this standard enables **self-contained, platform-independent content packages** that preserve both resources and structural organization. This documentation covers specification versions 1.1.x through 1.2, technical implementation details, metadata integration with IEEE LOM, and critical QTI assessment packaging requirements across versions 2.0 through 3.0.

## Spec snapshots (local)

For QTI packaging details, see [SPEC_SNAPSHOTS.md](./SPEC_SNAPSHOTS.md) (QTI **2.2.2** primary reference; supports QTI **2.1–2.2.x** input).

---

## Purpose and evolution of content packaging

IMS Content Packaging addresses a fundamental challenge in e-learning: enabling instructional materials to interoperate across independently developed authoring tools, LMSs, and runtime environments. The specification defines standardized data structures that allow systems to **import, export, aggregate, and disaggregate packages of content** while retaining structural information such as table of contents, navigation order, and metadata.

A content package is a self-contained unit that may represent a single lesson, complete course, or collection of courses. Each package includes all information needed to use the contents for learning—resources, organizational structure, and descriptive metadata bundled together.

### Version history and key changes

| Version | Release Date | Status | Key Changes |
|---------|-------------|--------|-------------|
| **v1.1** | April 2001 | Final | First major functional revision |
| **v1.1.2** | August 2001 | Superseded | Editorial errata and implementer clarifications |
| **v1.1.3** | June 2003 | Superseded | Removed `<variation>` element |
| **v1.1.4** | October 2004 | **Current stable** | Fixed xml:lang namespace, clarified organizations element, dependency restrictions |
| **v1.2** | March 2007 | Public Draft | UML documentation style, ISO/IEC standardization process, enhanced linking |

The progression from 1.1.x to 1.2 introduced **UML-based documentation** while maintaining v1.1.4 as the base model. Version 1.2 adds new extension objects for cross-references and underwent ISO/IEC standardization. SCORM 1.2 uses IMS CP v1.1.2, while **SCORM 2004 uses IMS CP v1.1.4**.

---

## Package Interchange File format and structure

A Package Interchange File (PIF) is a single compressed archive containing all package components. The **PKZip v2.04g format (.zip)** conforming to RFC1951 is the recommended default, though .jar and .cab formats are also acceptable.

### Root-level requirements

The manifest file `imsmanifest.xml` **must be placed at the root** of the package—this filename must be lowercase. Without this file, the package is invalid. XML schema files referenced by the manifest should also reside at the root level.

```
package.zip/
├── imsmanifest.xml          (REQUIRED - root level, lowercase)
├── imscp_v1p1.xsd           (schema file - root level)
├── imsmd_v1p2.xsd           (metadata schema - root level)
├── content/
│   ├── lesson1.html
│   └── images/
│       └── diagram.png
└── resources/
    └── styles.css
```

### Manifest element hierarchy

The `imsmanifest.xml` file follows a strict element ordering:

```
manifest (root)
├── metadata (optional, 0..1)
│   ├── schema
│   ├── schemaversion
│   └── {LOM metadata}
├── organizations (required, exactly 1)
│   └── organization (0..n)
│       ├── title
│       └── item (1..n, nestable)
├── resources (required, exactly 1)
│   └── resource (0..n)
│       ├── metadata
│       ├── file (0..n)
│       └── dependency (0..n)
└── manifest (optional sub-manifests)
```

---

## Namespace declarations and schema references

Proper namespace configuration is critical for validation and interoperability. The following declarations are required for IMS CP v1.1.4 with metadata:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest 
    xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
    xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    identifier="MANIFEST-ID"
    version="1.1.4"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                        http://www.imsglobal.org/xsd/imsmd_v1p2 imsmd_v1p2.xsd">
```

| Namespace | URI | Purpose |
|-----------|-----|---------|
| IMS CP v1.1 | `http://www.imsglobal.org/xsd/imscp_v1p1` | Default namespace |
| IMS Metadata | `http://www.imsglobal.org/xsd/imsmd_v1p2` | IMS Metadata v1.2 |
| IEEE LOM | `http://ltsc.ieee.org/xsd/LOM` | IEEE Learning Object Metadata |
| XML Schema Instance | `http://www.w3.org/2001/XMLSchema-instance` | Schema validation |

---

## Organizations element and content structure

The `<organizations>` element contains one or more structural views for presenting content. It must occur exactly once per manifest and supports a `default` attribute pointing to the primary organization.

### Organization and item structure

```xml
<organizations default="TOC1">
    <organization identifier="TOC1" structure="hierarchical">
        <title>Introduction to Programming</title>
        
        <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
            <title>Module 1: Getting Started</title>
            
            <!-- Nested items create hierarchy -->
            <item identifier="ITEM-1-1" identifierref="RES-2">
                <title>1.1 Installation</title>
            </item>
            <item identifier="ITEM-1-2" identifierref="RES-3">
                <title>1.2 First Program</title>
            </item>
        </item>
        
        <item identifier="ITEM-2" identifierref="RES-4">
            <title>Module 2: Variables</title>
        </item>
    </organization>
</organizations>
```

The `<item>` element represents nodes in the content hierarchy with key attributes:

- **identifier**: Unique ID within the manifest (required)
- **identifierref**: References a resource identifier (optional)
- **isvisible**: Boolean for navigation display (default: true)
- **parameters**: Launch parameters in format `?name=value` or `#fragment`

For QTI packages, the **organizations element is typically empty** (`<organizations/>`) since assessment structure is defined within QTI content files.

---

## Resources element and file references

The `<resources>` element contains all resource references without hierarchy. Each `<resource>` describes an asset or collection of related files.

```xml
<resources xml:base="content/">
    <!-- Main lesson resource -->
    <resource identifier="RES-1" type="webcontent" href="lesson1.html">
        <file href="lesson1.html"/>
        <file href="images/diagram1.png"/>
        <dependency identifierref="SHARED-ASSETS"/>
    </resource>
    
    <!-- Shared assets container -->
    <resource identifier="SHARED-ASSETS" type="webcontent">
        <file href="css/styles.css"/>
        <file href="js/common.js"/>
        <file href="images/logo.png"/>
    </resource>
</resources>
```

### Resource attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `identifier` | **Yes** | Unique ID referenced by items |
| `type` | **Yes** | Resource type (e.g., `webcontent`) |
| `href` | No | Entry point URL (RFC2396 compliant) |
| `xml:base` | No | Overrides parent base path |

The `<dependency>` element links resources that share assets. Dependencies **cannot reference resources in sub-manifests**.

---

## IEEE LOM metadata integration

IMS Content Packaging integrates IEEE 1484.12.1-2002 Learning Object Metadata (LOM) for describing packages and resources. LOM defines **nine hierarchical categories** containing approximately 86 individual metadata elements.

### LOM category structure

| Category | Purpose | Key Elements |
|----------|---------|--------------|
| **General** | Overall description | title, description, keywords, language |
| **Lifecycle** | History and state | version, status, contributors |
| **Meta-Metadata** | Metadata about metadata | metadata scheme, language |
| **Technical** | Technical requirements | format, size, requirements |
| **Educational** | Pedagogic characteristics | interactivity type, learning resource type, audience |
| **Rights** | Intellectual property | cost, copyright restrictions |
| **Relation** | Relationships to other objects | isPartOf, requires, references |
| **Annotation** | Usage comments | reviewer notes, recommendations |
| **Classification** | Taxonomic classification | discipline, educational objective |

### Inline metadata example

```xml
<metadata>
    <schema>IMS Content</schema>
    <schemaversion>1.1.4</schemaversion>
    <imsmd:lom>
        <imsmd:general>
            <imsmd:title>
                <imsmd:langstring xml:lang="en">Course Title</imsmd:langstring>
            </imsmd:title>
            <imsmd:language>en</imsmd:language>
            <imsmd:description>
                <imsmd:langstring xml:lang="en">Course description</imsmd:langstring>
            </imsmd:description>
            <imsmd:keyword>
                <imsmd:langstring xml:lang="en">e-learning</imsmd:langstring>
            </imsmd:keyword>
        </imsmd:general>
        <imsmd:educational>
            <imsmd:learningresourcetype>
                <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
                <imsmd:value><imsmd:langstring>narrative text</imsmd:langstring></imsmd:value>
            </imsmd:learningresourcetype>
            <imsmd:intendedenduserrole>
                <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
                <imsmd:value><imsmd:langstring>learner</imsmd:langstring></imsmd:value>
            </imsmd:intendedenduserrole>
        </imsmd:educational>
        <imsmd:rights>
            <imsmd:copyrightandotherrestrictions>
                <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
                <imsmd:value><imsmd:langstring>yes</imsmd:langstring></imsmd:value>
            </imsmd:copyrightandotherrestrictions>
            <imsmd:description>
                <imsmd:langstring xml:lang="en">CC BY-NC-SA 4.0</imsmd:langstring>
            </imsmd:description>
        </imsmd:rights>
    </imsmd:lom>
</metadata>
```

### Metadata placement and requirements

**All LOM data elements are optional** per IEEE 1484.12.1-2002. However, for interoperability, these elements are strongly recommended: **title, language, description, keyword, format, learningresourcetype, and copyright information**.

Metadata can be placed at manifest, organization, item, resource, or file levels. For QTI packages, resource-level metadata is primary—manifest-level metadata describes the package itself, not its contents.

---

## QTI packaging across specification versions

IMS Question and Test Interoperability (QTI) uses IMS Content Packaging to organize and exchange assessment content. Each QTI version defines specific resource type identifiers.

### Resource type declarations by version

| Version | Content Type | Resource Type Value |
|---------|-------------|---------------------|
| **QTI 2.2** | Assessment Item | `imsqti_item_xmlv2p2` |
| **QTI 2.2** | Assessment Test | `imsqti_test_xmlv2p2` |
| **QTI 2.2** | Response Processing Template | `imsqti_rptemplate_xmlv2p2` |

### QTI 2.x manifest structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
    xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
    xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_metadata_v2p2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    identifier="QTI-BANK-1"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd 
        http://www.imsglobal.org/xsd/imsqti_metadata_v2p2 imsqti_metadata_v2p2.xsd">
    
    <metadata>
        <schema>IMS Content</schema>
        <schemaversion>1.1.4</schemaversion>
    </metadata>
    
    <organizations/>
    
    <resources>
        <!-- Assessment Item -->
        <resource identifier="question_1" type="imsqti_item_xmlv2p2" href="items/question_1.xml">
            <metadata>
                <imsqti:qtiMetadata>
                    <imsqti:interactionType>choiceInteraction</imsqti:interactionType>
                    <imsqti:timeDependent>false</imsqti:timeDependent>
                </imsqti:qtiMetadata>
            </metadata>
            <file href="items/question_1.xml"/>
            <file href="images/diagram.png"/>
        </resource>
        
        <!-- Assessment Test referencing items -->
        <resource identifier="test_1" type="imsqti_test_xmlv2p2" href="test.xml">
            <file href="test.xml"/>
            <dependency identifierref="question_1"/>
            <dependency identifierref="question_2"/>
        </resource>
    </resources>
</manifest>
```

## XML schema validation requirements

Validation ensures package conformance and interoperability. Required XSD files for IMS CP v1.1.4:

| Schema File | Namespace | Purpose |
|-------------|-----------|---------|
| `imscp_v1p1.xsd` | http://www.imsglobal.org/xsd/imscp_v1p1 | Content Packaging |
| `imsmd_v1p2.xsd` | http://www.imsglobal.org/xsd/imsmd_v1p2 | IMS Metadata |
| `imsqti_v2p2p2.xsd` | http://www.imsglobal.org/xsd/imsqti_v2p2 | QTI v2.2 |

### Common validation errors and solutions

**ID/IDREF binding errors** occur when `identifierref` values don't match existing identifiers:
```xml
<!-- Error: REF-001 doesn't exist -->
<item identifierref="REF-001">

<!-- Solution: Ensure matching identifier exists -->
<item identifierref="RES-1">
<resource identifier="RES-1" .../>
```

**Manifest location errors** happen when `imsmanifest.xml` isn't at package root. When creating ZIPs, compress from inside the content folder, not the parent directory:
```bash
cd package_folder && zip -r ../package.zip .
```

**Namespace declaration errors** cause parsing failures. Always declare required namespaces including the `xsi:schemaLocation` for validation.

---

## Implementation patterns and best practices

### Conformance levels

**Level 0 (Basic)**: Package must contain `imsmanifest.xml` at root, include referenced schema files, and preserve all CP and metadata elements on re-transmittal.

**Level 1 (Full)**: All Level 0 requirements plus preservation of all namespaced extensions.

### Identifier best practices

Use globally unique identifiers (UUIDs or URIs) for packages exchanged between systems. Identifiers must start with a letter and contain only letters, digits, hyphens, underscores, and periods:

```xml
<manifest identifier="urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6">
<resource identifier="RES-MODULE-01-LESSON-01">
```

### Dependency pattern for shared resources

```xml
<resources>
    <resource identifier="RES-1" type="webcontent" href="page.html">
        <file href="page.html"/>
        <dependency identifierref="SHARED-ASSETS"/>
    </resource>
    
    <resource identifier="SHARED-ASSETS" type="webcontent">
        <file href="shared/styles.css"/>
        <file href="shared/scripts.js"/>
        <file href="shared/images/logo.png"/>
    </resource>
</resources>
```

### LMS integration requirements

- File `imsmanifest.xml` **must be lowercase**
- **UTF-8 encoding** is required
- `xml:base` attributes should not begin with leading forward slash
- Relative URLs resolve from the package root (manifest location)
- External resources use fully qualified URLs without `<file>` elements

---

## Complete manifest template with QTI content

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
    xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
    xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_metadata_v2p2"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    identifier="COMPLETE-PACKAGE-001"
    xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
        http://www.imsglobal.org/xsd/imsmd_v1p2 imsmd_v1p2.xsd
        http://www.imsglobal.org/xsd/imsqti_metadata_v2p2 imsqti_metadata_v2p2.xsd">
    
    <!-- Package Metadata -->
    <metadata>
        <schema>IMS Content</schema>
        <schemaversion>1.1.4</schemaversion>
        <imsmd:lom>
            <imsmd:general>
                <imsmd:title>
                    <imsmd:langstring xml:lang="en">Assessment Package</imsmd:langstring>
                </imsmd:title>
                <imsmd:language>en</imsmd:language>
            </imsmd:general>
            <imsmd:rights>
                <imsmd:copyrightandotherrestrictions>
                    <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
                    <imsmd:value><imsmd:langstring>yes</imsmd:langstring></imsmd:value>
                </imsmd:copyrightandotherrestrictions>
            </imsmd:rights>
        </imsmd:lom>
    </metadata>
    
    <!-- Organizations (empty for QTI) -->
    <organizations/>
    
    <!-- Resources -->
    <resources>
        <!-- QTI Assessment Test -->
        <resource identifier="TEST-1" type="imsqti_test_xmlv2p2" href="tests/assessment.xml">
            <file href="tests/assessment.xml"/>
            <dependency identifierref="ITEM-1"/>
            <dependency identifierref="ITEM-2"/>
        </resource>
        
        <!-- QTI Assessment Items -->
        <resource identifier="ITEM-1" type="imsqti_item_xmlv2p2" href="items/question1.xml">
            <metadata>
                <imsqti:qtiMetadata>
                    <imsqti:interactionType>choiceInteraction</imsqti:interactionType>
                    <imsqti:timeDependent>false</imsqti:timeDependent>
                </imsqti:qtiMetadata>
            </metadata>
            <file href="items/question1.xml"/>
            <dependency identifierref="SHARED-MEDIA"/>
        </resource>
        
        <resource identifier="ITEM-2" type="imsqti_item_xmlv2p2" href="items/question2.xml">
            <metadata>
                <imsqti:qtiMetadata>
                    <imsqti:interactionType>textEntryInteraction</imsqti:interactionType>
                    <imsqti:timeDependent>false</imsqti:timeDependent>
                </imsqti:qtiMetadata>
            </metadata>
            <file href="items/question2.xml"/>
        </resource>
        
        <!-- Shared Resources -->
        <resource identifier="SHARED-MEDIA" type="webcontent">
            <file href="media/images/diagram.png"/>
            <file href="media/css/styles.css"/>
        </resource>
    </resources>
</manifest>
```

---

## Conclusion

IMS Content Packaging provides a robust, extensible framework for e-learning content exchange that has stood the test of time across two decades of educational technology evolution. The specification's integration with IEEE LOM enables rich metadata description, while its profiling by QTI, SCORM, and Common Cartridge demonstrates broad industry adoption.

For implementation, **version 1.1.4 remains the most widely deployed** baseline, with v1.2 offering enhanced capabilities for newer deployments. For QTI in this repo, we target **QTI 2.2** resource types and namespaces.

Successful implementation requires attention to: lowercase `imsmanifest.xml` placement at package root, proper namespace declarations, valid ID/IDREF relationships, and appropriate resource type declarations for content being packaged. Testing with multiple validators and target LMS platforms ensures broad interoperability.