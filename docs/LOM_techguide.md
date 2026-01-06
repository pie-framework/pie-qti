# IEEE LOM Metadata for Assessment Systems and IMS QTI

IEEE Learning Object Metadata (LOM) provides the foundational framework for describing assessment items, with IMS QTI extending this through specialized metadata elements for question and test interoperability. The **IEEE 1484.12.1-2002** standard defines nine metadata categories containing 76 elements that enable discovery, management, and exchange of educational resources—including assessment content. QTI's `qtiMetadata` element adds **11 assessment-specific fields** covering interaction types, scoring modes, and feedback characteristics that LOM cannot express. Together, these standards enable interoperable item banks supporting automated test assembly, standards alignment, and cross-platform content exchange.

## Spec snapshots (local)

For the QTI-side of this mapping, see [SPEC_SNAPSHOTS.md](./SPEC_SNAPSHOTS.md) (QTI **2.2.2** primary reference; supports QTI **2.1–2.2.x** input).

---

## IEEE 1484.12.1-2002 standard architecture

The IEEE LOM standard establishes a hierarchical data model through a multi-part specification. **IEEE 1484.12.1** defines the conceptual data schema, while **IEEE 1484.12.3** (revised 2020) provides the XML binding, and the proposed IEEE 1484.12.4 addresses RDF binding (never finalized). The standard defines a "learning object" broadly as any entity—digital or non-digital—used for learning, education, or training.

The nine top-level categories organize metadata logically:

| Category | Element Count | Assessment Relevance |
|----------|--------------|---------------------|
| **1. General** | 8 elements | Identifier, title, keywords—critical for discovery |
| **2. Lifecycle** | 6 elements | Version control, contributor tracking for item banks |
| **3. Meta-Metadata** | 9 elements | Metadata provenance and schema identification |
| **4. Technical** | 11 elements | Format, size, delivery requirements |
| **5. Educational** | 11 elements | Difficulty, learning time, resource type—high value for assessments |
| **6. Rights** | 3 elements | Copyright, access restrictions for secure items |
| **7. Relation** | 4 elements | Item-to-item relationships, test membership |
| **8. Annotation** | 3 elements | Usage notes and reviewer comments |
| **9. Classification** | 8 elements | Taxonomic alignment, competency mapping—essential for item selection |

### Data types and cardinality rules

LOM employs six fundamental data types with specific encoding requirements:

**CharacterString** conforms to ISO/IEC 10646-1:2000 (Unicode 3.0.1), with maximum lengths specified per element (typically 500-2000 characters). **LangString** enables multilingual content through Language-String pairs, allowing the same information in multiple languages. **Vocabulary** constrains values to controlled lists via Source-Value pairs, where Source identifies the vocabulary authority (e.g., "LOMv1.0") and Value contains the term.

**DateTime** follows ISO 8601 encoding with an optional description (e.g., `2024-07-26T12:15:35`). **Duration** also uses ISO 8601 format for time periods (e.g., `PT1H30M` for 1 hour 30 minutes). **vCard** encodes person/organization information per RFC 2425/2426.

The **Smallest Permitted Maximum (SPM)** defines minimum processing requirements:

```
General.Identifier: 10 instances | Lifecycle.Contribute: 30 instances
Classification instances: 40 | Educational instances: 100
CharacterString lengths: 500-2000 characters depending on element
```

---

## LOM XML binding and namespaces

The IEEE 1484.12.3-2020 standard defines the authoritative XML binding with these key namespaces:

```xml
<!-- IEEE LOM Namespace -->
xmlns:lom="http://ltsc.ieee.org/xsd/LOM"
xsi:schemaLocation="http://ltsc.ieee.org/xsd/LOM lomv1.0/lom.xsd"

<!-- IMS LOM Profile Namespace (commonly used) -->
xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"

<!-- QTI Metadata Namespace (3.0) -->
xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_metadata_v3p0"
```

The binding provides three schema variants: **lomStrict.xsd** validates strictly conforming instances containing only standard LOM elements; **lomLoose.xsd** permits vocabulary extensions; and **lom.xsd** serves as the base schema. Applications must process at least the SPM values and may not impose lower maximums.

---

## General category for assessment identification

The General category provides discovery metadata essential for item bank operations. The **identifier** element (1.1) must contain at least one value matching the associated QTI assessmentItem's identifier attribute. Best practice uses globally unique identifiers with a catalog-entry structure:

```xml
<general>
  <identifier>
    <catalog>ItemBank-Institution</catalog>
    <entry>MATH-ALG-2024-Q042</entry>
  </identifier>
  <title>
    <string language="en">Quadratic Formula Application</string>
  </title>
  <language>en-US</language>
  <description>
    <string language="en">Solve quadratic equations using the 
    quadratic formula with integer coefficients</string>
  </description>
  <keyword><string language="en">algebra</string></keyword>
  <keyword><string language="en">quadratic equations</string></keyword>
</general>
```

The **title** element must match the QTI item's title attribute for consistency. **Language** (1.3) must include one value for each language used in the item—critical for multilingual item banks. The QTI specification recommends against using **Structure** (1.7) and **Aggregation Level** (1.8) for assessment items, as assessments have their own organizational hierarchy (items → sections → tests).

---

## Educational category defines assessment characteristics

The Educational category (repeatable up to **100 times**) contains the most assessment-relevant metadata, though QTI profiles recommend against several elements in favor of QTI-specific alternatives.

### Learning resource type for assessments

Element 5.2 Learning Resource Type distinguishes assessment content. The QTI profile explicitly permits **exercise** and **questionnaire** but **forbids** "exam" and "self assessment" because QTI items should be reusable across contexts:

| Permitted Value | Assessment Application |
|-----------------|----------------------|
| `exercise` | Practice items, formative assessments, drill activities |
| `questionnaire` | Survey instruments, attitudinal measures, feedback forms |

Extended vocabularies (e.g., RDN/LTSN) provide assessment-specific values: `AssessmentItem`, `ExaminationTest`, `QuestionBank`.

### Difficulty and learning time interpretation

The **difficulty** element (5.8) uses a five-level vocabulary: Very Easy, Easy, Medium, Difficult, Very Difficult. However, the QTI profile recommends using **Usage Data** with empirical statistics (p-value, IRT parameters) rather than subjective difficulty ratings.

**Typical Learning Time** (5.9) has specific meaning for assessments: "the length of time the candidate would normally be allocated to complete the object—**it is NOT a time limit**." Format uses ISO 8601 duration (e.g., `PT5M` for 5 minutes). This enables test duration estimation during automated assembly.

### Elements deprecated for QTI use

The QTI specification deprecates these Educational elements:

- **Interactivity Type** (5.1)—replaced by QTI's 22 specific `interactionType` values
- **Interactivity Level** (5.3) and **Semantic Density** (5.4)—subjective and unreliable
- **Intended End User Role** (5.5) and **Typical Age Range** (5.7)—context-dependent

---

## Technical requirements for assessment delivery

The Technical category specifies delivery requirements through format declarations and platform dependencies.

### MIME types for QTI content

Element 4.1 Format must include appropriate MIME types:

| MIME Type | Content |
|-----------|---------|
| `text/x-imsqti-item-xml` | QTI assessment item |
| `text/x-imsqti-test-xml` | QTI test definition |
| `application/xml` | Generic XML content |
| `image/png`, `image/jpeg` | Stimulus images |
| `audio/mpeg`, `video/mp4` | Multimedia stimuli |

The **size** element (4.2) records bytes for bandwidth planning. The QTI profile recommends against LOM's structured **Requirement** elements (4.4), instead using **otherPlatformRequirements** (4.6) for browser or accessibility technology requirements.

---

## Rights management for assessment security

The Rights category addresses intellectual property but has significant limitations for assessment contexts. Elements 6.1 (Cost) and 6.2 (Copyright and Other Restrictions) provide only binary yes/no values—insufficient for complex item bank licensing.

The **description** element (6.3) should specify:
- Security classification (secure vs. released items)
- Licensing terms and permitted uses
- Modification permissions
- Media file restrictions (items using shared media must reflect media rights)

```xml
<rights>
  <cost><value>yes</value></cost>
  <copyrightAndOtherRestrictions><value>yes</value></copyrightAndOtherRestrictions>
  <description>
    <string language="en">Secure operational item. Reproduction 
    prohibited outside authorized testing contexts. Item bank 
    subscription required. © 2024 Assessment Publisher.</string>
  </description>
</rights>
```

---

## Classification enables taxonomic alignment and competency mapping

The Classification category provides the **preferred mechanism** for mapping assessments to educational standards, taxonomies, and competencies. Multiple classification instances (up to **40 permitted**) allow simultaneous subject area, cognitive level, and standards tagging.

### Purpose values for assessment metadata

| Purpose | Assessment Use |
|---------|---------------|
| `discipline` | Subject area (preferred over General.keyword for subject tagging) |
| `idea` | Specific topics within subjects |
| `educational objective` | Learning outcomes, Bloom's Taxonomy levels |
| `competency` | Standards alignment (CCSS, NGSS, state standards) |
| `skill level` | Webb's Depth of Knowledge, proficiency levels |
| `educational level` | Grade level classification |
| `security level` | Item exposure status (custom extension) |

### Mapping Bloom's Revised Taxonomy

```xml
<classification>
  <purpose>
    <source><langstring>LOMv1.0</langstring></source>
    <value><langstring>educational objective</langstring></value>
  </purpose>
  <taxonPath>
    <source><string language="en">Bloom's Revised Taxonomy (2001)</string></source>
    <taxon>
      <id>3</id>
      <entry><string language="en">Apply</string></entry>
    </taxon>
    <taxon>
      <id>3.2</id>
      <entry><string language="en">Implementing</string></entry>
    </taxon>
  </taxonPath>
</classification>
```

Bloom's levels map to assessment item types: **Remember** (recall items), **Understand** (matching/classification), **Apply** (calculations/problem-solving), **Analyze** (data analysis), **Evaluate** (judgment tasks), **Create** (design/construction tasks).

### Webb's Depth of Knowledge mapping

DOK classification uses `purpose="skill level"`:

| DOK Level | Item Characteristics |
|-----------|---------------------|
| DOK 1 | Simple recall, recognition, one-step procedures |
| DOK 2 | Decisions, multiple steps, basic inferences |
| DOK 3 | Reasoning, planning, evidence-based analysis |
| DOK 4 | Investigation, synthesis across sources |

### Competency framework integration via CASE

The 1EdTech CASE (Competencies and Academic Standards Exchange) standard provides machine-readable GUIDs for standards alignment:

```xml
<classification>
  <purpose><value>competency</value></purpose>
  <taxonPath>
    <source><string>Common Core State Standards - Mathematics</string></source>
    <taxon>
      <id>urn:case:guid:8a9c1234-5678-abcd-ef01-234567890abc</id>
      <entry><string>CCSS.MATH.CONTENT.HSA.REI.B.4</string></entry>
    </taxon>
  </taxonPath>
</classification>
```

---

## Lifecycle category for item bank management

Version control and contributor tracking support item bank production workflows.

### Status vocabulary and extensions

LOM's four-value status vocabulary often proves insufficient:

| LOM Value | Item Bank Application |
|-----------|----------------------|
| `draft` | Items under development |
| `final` | Approved for operational use |
| `revised` | Updated version available |
| `unavailable` | Retired items |

Production workflows often require extended status via Classification category: `field test`, `operational`, `secure`, `released`, `retired`.

### Contributor roles for item development

```xml
<lifecycle>
  <version><string>2.1.0</string></version>
  <status><value>final</value></status>
  <contribute>
    <role><value>author</value></role>
    <entity>BEGIN:VCARD\nFN:Jane Smith\nORG:Assessment Division\nEND:VCARD</entity>
    <date><dateTime>2024-06-15</dateTime></date>
  </contribute>
  <contribute>
    <role><value>validator</value></role>
    <entity>BEGIN:VCARD\nFN:Content Review Committee\nEND:VCARD</entity>
    <date><dateTime>2024-07-01</dateTime></date>
  </contribute>
</lifecycle>
```

Relevant roles include: **author** (item writer), **validator** (content/psychometric reviewer), **publisher** (organization), **editor**, **graphical designer** (media creator), **technical validator** (QTI/format reviewer).

---

## QTI metadata extends LOM for assessment specifics

The IMS QTI specification defines the `qtiMetadata` element as an **additional category augmenting IEEE LOM** rather than replacing it. QTI 3.0 includes **11 child elements** with assessment-specific semantics unavailable in LOM.

### qtiMetadata element structure (QTI 3.0)

| Element | Type | Purpose |
|---------|------|---------|
| `itemTemplate` | Boolean | True if item uses templateProcessing for variants |
| `timeDependent` | Boolean | Whether response time affects scoring |
| `composite` | Boolean | True if item contains multiple interactions |
| `interactionType` | Enum (22 values) | Type(s) of interaction in item |
| `feedbackType` | Enum | adaptive/nonadaptive/none |
| `solutionAvailable` | Boolean | Model solution provided |
| `scoringMode` | Enum | responseprocessing/human/externalmachine |
| `toolName` | String | Authoring tool name |
| `toolVersion` | String | Tool version |
| `toolVendor` | String | Tool vendor |
| `portableCustomInteractionContext` | Complex | PCI metadata (QTI 3.0 only) |

### Interaction types vocabulary

QTI 3.0 defines **22 interaction types**:

```
associateInteraction, choiceInteraction, customInteraction, 
drawingInteraction, endAttemptInteraction, extendedTextInteraction, 
gapMatchInteraction, graphicAssociateInteraction, graphicGapMatchInteraction, 
graphicOrderInteraction, hotspotInteraction, hottextInteraction, 
inlineChoiceInteraction, matchInteraction, mediaInteraction, orderInteraction, 
portableCustomInteraction*, positionObjectInteraction, selectPointInteraction, 
sliderInteraction, textEntryInteraction, uploadInteraction
```
*portableCustomInteraction added in QTI 3.0

### Feedback and scoring metadata

**feedbackType** indicates feedback availability:
- `adaptive`: Feedback considers accumulated attempt history
- `nonadaptive`: Feedback based only on current response
- `none`: No feedback available

**solutionAvailable** (Boolean) enables "show solution" functionality when true.

**scoringMode** (added QTI 2.2) indicates scoring approach:
- `responseprocessing`: Automated via item's response processing rules
- `human`: Requires human scoring
- `externalmachine`: External AI/machine scoring

---

## QTI-LOM integration architecture

QTI metadata appears as a **sibling to LOM categories** within the metadata element, not as an extension of LOM itself:

```xml
<metadata>
  <!-- IEEE LOM -->
  <lom:lom xmlns:lom="http://ltsc.ieee.org/xsd/LOM">
    <lom:general><!-- identification --></lom:general>
    <lom:lifecycle><!-- versioning --></lom:lifecycle>
    <lom:educational><!-- learning characteristics --></lom:educational>
    <lom:classification><!-- taxonomic alignment --></lom:classification>
  </lom:lom>
  
  <!-- QTI-Specific -->
  <imsqti:qtiMetadata xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_metadata_v3p0">
    <imsqti:itemTemplate>false</imsqti:itemTemplate>
    <imsqti:timeDependent>false</imsqti:timeDependent>
    <imsqti:composite>false</imsqti:composite>
    <imsqti:interactionType>choiceInteraction</imsqti:interactionType>
    <imsqti:feedbackType>nonadaptive</imsqti:feedbackType>
    <imsqti:solutionAvailable>true</imsqti:solutionAvailable>
    <imsqti:scoringMode>responseprocessing</imsqti:scoringMode>
  </imsqti:qtiMetadata>
</metadata>
```

### LOM elements profiled by QTI

The QTI specification recommends specific LOM usage:

- **Meta-Metadata.metadataSchema** should include "QTIv3.0" and "LOMv1.0"
- **Technical.format** should include `text/x-imsqti-item-xml` or `text/x-imsqti-test-xml`
- **Relation** supports `precludes` (custom extension) for enemy items that cannot appear together

---

## IMS Content Package integration

Assessment content packages combine QTI items with LOM metadata through the IMS Content Packaging specification. The `imsmanifest.xml` file declares resources and their metadata.

### Package structure

```
package.zip/
├── imsmanifest.xml           # Required manifest
├── items/
│   ├── item001.xml          # QTI assessment items
│   └── item002.xml
├── tests/
│   └── test001.xml          # QTI test definition
└── media/
    └── diagram.png          # Supporting resources
```

### Complete manifest example with LOM and QTI metadata

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-ITEMBANK-001"
    xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
    xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
    xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_metadata_v3p0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    
  <!-- PACKAGE-LEVEL METADATA -->
  <metadata>
    <schema>IMS QTI</schema>
    <schemaversion>3.0</schemaversion>
    <imsmd:lom>
      <imsmd:general>
        <imsmd:identifier>
          <imsmd:catalog>ItemBank</imsmd:catalog>
          <imsmd:entry>MATH-ALGEBRA-2024</imsmd:entry>
        </imsmd:identifier>
        <imsmd:title>
          <imsmd:langstring xml:lang="en">Algebra Item Bank</imsmd:langstring>
        </imsmd:title>
        <imsmd:description>
          <imsmd:langstring xml:lang="en">Grade 8-10 algebra assessment items 
          aligned to Common Core standards</imsmd:langstring>
        </imsmd:description>
      </imsmd:general>
      <imsmd:lifecycle>
        <imsmd:version><imsmd:langstring>2.0</imsmd:langstring></imsmd:version>
        <imsmd:status>
          <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
          <imsmd:value><imsmd:langstring>Final</imsmd:langstring></imsmd:value>
        </imsmd:status>
      </imsmd:lifecycle>
    </imsmd:lom>
  </metadata>
    
  <organizations/>
    
  <resources>
    <!-- ASSESSMENT ITEM WITH FULL METADATA -->
    <resource identifier="ITEM-001" type="imsqti_item_xmlv3p0" 
              href="items/item001.xml">
      <metadata>
        <!-- LOM METADATA -->
        <imsmd:lom>
          <imsmd:general>
            <imsmd:identifier>
              <imsmd:catalog>ItemBank</imsmd:catalog>
              <imsmd:entry>ITEM-QUAD-001</imsmd:entry>
            </imsmd:identifier>
            <imsmd:title>
              <imsmd:langstring xml:lang="en">Quadratic Equation - 
              Standard Form</imsmd:langstring>
            </imsmd:title>
            <imsmd:language>en-US</imsmd:language>
            <imsmd:keyword>
              <imsmd:langstring xml:lang="en">quadratic equations</imsmd:langstring>
            </imsmd:keyword>
          </imsmd:general>
          
          <imsmd:lifecycle>
            <imsmd:version><imsmd:langstring>1.2</imsmd:langstring></imsmd:version>
            <imsmd:status>
              <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
              <imsmd:value><imsmd:langstring>Final</imsmd:langstring></imsmd:value>
            </imsmd:status>
            <imsmd:contribute>
              <imsmd:role>
                <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
                <imsmd:value><imsmd:langstring>Author</imsmd:langstring></imsmd:value>
              </imsmd:role>
              <imsmd:centity>
                <imsmd:vcard>BEGIN:vCard
FN:Maria Garcia
ORG:Mathematics Department
END:vCard</imsmd:vcard>
              </imsmd:centity>
            </imsmd:contribute>
          </imsmd:lifecycle>
          
          <imsmd:technical>
            <imsmd:format>text/x-imsqti-item-xml</imsmd:format>
            <imsmd:size>3842</imsmd:size>
          </imsmd:technical>
          
          <imsmd:educational>
            <imsmd:learningresourcetype>
              <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
              <imsmd:value><imsmd:langstring>exercise</imsmd:langstring></imsmd:value>
            </imsmd:learningresourcetype>
            <imsmd:context>
              <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
              <imsmd:value><imsmd:langstring>school</imsmd:langstring></imsmd:value>
            </imsmd:context>
            <imsmd:typicallearningtime>
              <imsmd:datetime>PT3M</imsmd:datetime>
            </imsmd:typicallearningtime>
          </imsmd:educational>
          
          <imsmd:rights>
            <imsmd:copyrightandotherrestrictions>
              <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
              <imsmd:value><imsmd:langstring>yes</imsmd:langstring></imsmd:value>
            </imsmd:copyrightandotherrestrictions>
          </imsmd:rights>
          
          <!-- Subject Classification -->
          <imsmd:classification>
            <imsmd:purpose>
              <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
              <imsmd:value><imsmd:langstring>discipline</imsmd:langstring></imsmd:value>
            </imsmd:purpose>
            <imsmd:taxonpath>
              <imsmd:source><imsmd:langstring>Subject Taxonomy</imsmd:langstring></imsmd:source>
              <imsmd:taxon>
                <imsmd:id>510</imsmd:id>
                <imsmd:entry><imsmd:langstring>Mathematics</imsmd:langstring></imsmd:entry>
              </imsmd:taxon>
              <imsmd:taxon>
                <imsmd:id>512</imsmd:id>
                <imsmd:entry><imsmd:langstring>Algebra</imsmd:langstring></imsmd:entry>
              </imsmd:taxon>
            </imsmd:taxonpath>
          </imsmd:classification>
          
          <!-- Bloom's Taxonomy Classification -->
          <imsmd:classification>
            <imsmd:purpose>
              <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
              <imsmd:value><imsmd:langstring>educational objective</imsmd:langstring></imsmd:value>
            </imsmd:purpose>
            <imsmd:taxonpath>
              <imsmd:source><imsmd:langstring>Bloom's Revised Taxonomy</imsmd:langstring></imsmd:source>
              <imsmd:taxon>
                <imsmd:id>3</imsmd:id>
                <imsmd:entry><imsmd:langstring>Apply</imsmd:langstring></imsmd:entry>
              </imsmd:taxon>
            </imsmd:taxonpath>
          </imsmd:classification>
          
          <!-- Standards Alignment -->
          <imsmd:classification>
            <imsmd:purpose>
              <imsmd:source><imsmd:langstring>LOMv1.0</imsmd:langstring></imsmd:source>
              <imsmd:value><imsmd:langstring>competency</imsmd:langstring></imsmd:value>
            </imsmd:purpose>
            <imsmd:taxonpath>
              <imsmd:source><imsmd:langstring>Common Core Mathematics</imsmd:langstring></imsmd:source>
              <imsmd:taxon>
                <imsmd:id>CCSS.MATH.CONTENT.HSA.REI.B.4</imsmd:id>
                <imsmd:entry><imsmd:langstring>Solve quadratic equations</imsmd:langstring></imsmd:entry>
              </imsmd:taxon>
            </imsmd:taxonpath>
          </imsmd:classification>
        </imsmd:lom>
        
        <!-- QTI-SPECIFIC METADATA -->
        <imsqti:qtiMetadata>
          <imsqti:itemTemplate>false</imsqti:itemTemplate>
          <imsqti:timeDependent>false</imsqti:timeDependent>
          <imsqti:composite>false</imsqti:composite>
          <imsqti:interactionType>choiceInteraction</imsqti:interactionType>
          <imsqti:feedbackType>nonadaptive</imsqti:feedbackType>
          <imsqti:solutionAvailable>true</imsqti:solutionAvailable>
          <imsqti:scoringMode>responseprocessing</imsqti:scoringMode>
          <imsqti:toolName>Assessment Authoring Suite</imsqti:toolName>
          <imsqti:toolVersion>5.2.1</imsqti:toolVersion>
          <imsqti:toolVendor>EdTech Solutions Inc.</imsqti:toolVendor>
        </imsqti:qtiMetadata>
      </metadata>
      <file href="items/item001.xml"/>
    </resource>
  </resources>
</manifest>
```

---

## Schema namespaces and validation requirements

### Key namespace URIs

| Specification | Namespace URI |
|---------------|---------------|
| IMS Content Package 1.1 | `http://www.imsglobal.org/xsd/imscp_v1p1` |
| IMS LOM 1.2.4 | `http://www.imsglobal.org/xsd/imsmd_v1p2` |
| IEEE LOM | `http://ltsc.ieee.org/xsd/LOM` |
| QTI 2.2 Metadata | `http://www.imsglobal.org/xsd/imsqti_metadata_v2p2` |

### Validation checklist

1. Manifest validates against `imscp_v1p1.xsd`
2. LOM metadata validates against `imsmd_v1p2p4.xsd` or IEEE `lom.xsd`
3. QTI metadata validates against version-appropriate `imsqti_metadata` schema
4. All file references in manifest resolve to actual files
5. Resource `type` attributes match expected QTI types (`imsqti_item_xmlv2p2`, `imsqti_test_xmlv2p2`)

The 1EdTech conformance validators (P1 for manifests, M2 for LOM, Q1 for QTI content) provide authoritative validation.

---

## Best practices for assessment metadata authoring

### Required minimum metadata set

Every assessment item should include:

| Element | Requirement | Rationale |
|---------|-------------|-----------|
| `general.identifier` | **Required** | Enables unique reference |
| `general.title` | **Required** | Human-readable identification |
| `general.language` | **Required** | Localization support |
| `technical.format` | **Required** | MIME type for processing |
| `rights.copyrightAndOtherRestrictions` | **Required** | Legal compliance |
| `lifecycle.version` | **Recommended** | Change tracking |
| `lifecycle.status` | **Recommended** | Workflow management |
| `educational.learningResourceType` | **Recommended** | Content classification |
| `classification` (discipline) | **Recommended** | Subject area filtering |

### Metadata workflow for item banks

**Authoring phase**: Assign unique persistent identifier, record author and date, apply initial keywords and classification. **Review phase**: Add reviewer contributions, update status from draft to final, validate content alignment. **Storage phase**: Apply full LOM profile with technical metadata, link related items via Relation category. **Exchange phase**: Package with IMS CP manifest, include schema references, validate complete package.

### Common implementation pitfalls

- **Missing identifiers**: Always provide `general.identifier` matching the QTI item identifier
- **Incomplete language tags**: Use proper BCP 47/RFC 1766 codes (e.g., `en-US`, not just `en`)
- **Orphaned classifications**: Document taxonPath sources so external systems can interpret them
- **Version drift**: Keep `lifecycle.version` synchronized with actual content changes
- **Overusing keywords**: Prefer Classification category for subject tagging over General.keyword

---

## Conclusion

IEEE LOM and IMS QTI metadata together provide a comprehensive framework for describing, managing, and exchanging assessment content. LOM's nine categories address universal metadata needs—identification, lifecycle management, technical requirements, educational characteristics, and taxonomic classification—while QTI's `qtiMetadata` element adds **assessment-specific semantics** for interaction types, scoring approaches, and feedback availability.

For item bank implementations, the **Classification category** proves most valuable for enabling subject area filtering, standards alignment, and cognitive level tagging through Bloom's Taxonomy or Webb's DOK. The **Lifecycle category** supports production workflows from draft through operational status. QTI metadata's **interactionType** and **scoringMode** elements enable automated test assembly based on item format and scoring requirements.

Successful implementation requires strict adherence to namespace declarations, consistent identifier schemes matching QTI content, and validation against authoritative schemas. The IMS Content Packaging specification provides the container format unifying LOM metadata, QTI content, and supporting resources into interoperable packages for cross-platform exchange.