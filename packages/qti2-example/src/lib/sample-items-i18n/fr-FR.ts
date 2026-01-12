/**
 * Sample QTI Items - fr-FR
 *
 * This file contains fr-FR translations of sample QTI assessment items.
 *
 * @generated This file was automatically generated from sample-items-i18n.ts
 */

/**
 * Localized item data structure
 */
export interface LocalizedItemData {
  title: string;
  description: string;
  xml: string;
}

/**
 * fr-FR translations of sample items
 *
 * Each key corresponds to a base item identifier, with the localized content
 * including title, description, and QTI XML.
 */
export const ITEMS_FR_FR: Record<string, LocalizedItemData> = {
  'capital-cities': {
    title: 'Capitales',
    description: 'Une question à choix multiples sur les capitales du monde',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="capital-cities.fr-FR"
  title="Capitales"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>paris</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Quelle est la capitale de la France?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <prompt>Choisissez la bonne ville:</prompt>
      <simpleChoice identifier="paris">Paris</simpleChoice>
      <simpleChoice identifier="london">Londres</simpleChoice>
      <simpleChoice identifier="berlin">Berlin</simpleChoice>
      <simpleChoice identifier="madrid">Madrid</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'extended-text': {
    title: 'Réponse de Texte Étendu',
    description: 'Une question ouverte sur la biologie cellulaire nécessitant une notation manuelle',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="extended-text.fr-FR"
  title="Réponse de Texte Étendu"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>4.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <rubricBlock view="scorer tutor author">
    <h3>Grille d'Évaluation</h3>
    <p><strong>4 points:</strong> Identifie les mitochondries comme le site de la respiration cellulaire, explique la production d'ATP, mentionne la conversion des nutriments en énergie utilisable, utilise une terminologie précise.</p>
    <p><strong>3 points:</strong> Identifie le rôle des mitochondries dans la production d'énergie, mentionne l'ATP ou la respiration cellulaire, inexactitudes mineures ou détails manquants.</p>
    <p><strong>2 points:</strong> Identifie correctement les mitochondries comme liées à l'énergie, explication vague ou incomplète.</p>
    <p><strong>1 point:</strong> Démontre une compréhension minimale, informations incorrectes ou non pertinentes avec quelques éléments corrects.</p>
    <p><strong>0 point:</strong> Aucune réponse ou réponse complètement incorrecte.</p>
  </rubricBlock>

  <rubricBlock view="candidate">
    <p><em>Votre réponse sera notée par votre instructeur en fonction de la précision scientifique et de l'exhaustivité. Assurez-vous d'expliquer la fonction spécifique des mitochondries dans les processus cellulaires.</em></p>
  </rubricBlock>

  <itemBody>
    <p>Expliquez le rôle des mitochondries dans la fonction cellulaire.</p>
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLines="3" expectedLength="200"/>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'hottext-single': {
    title: 'Interaction de Texte Cliquable - Sélection Simple',
    description: 'Une question de texte cliquable pour identifier les parties du discours',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-single.fr-FR"
  title="Interaction de Texte Cliquable - Sélection Simple"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>H2</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Grammaire:</strong> Sélectionnez le mot qui est un verbe dans la phrase suivante.</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Cliquez sur le verbe:</prompt>
      <p>Le <hottext identifier="H1">chat</hottext> <hottext identifier="H2">saute</hottext> par-dessus la <hottext identifier="H3">clôture</hottext>.</p>
    </hottextInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'inline-choice': {
    title: 'Question à Choix en Ligne',
    description: 'Une question à compléter sur la classification animale',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="inline-choice.fr-FR"
  title="Question à Choix en Ligne"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>vertebrate</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Un chien est un animal <inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false"><inlineChoice identifier="vertebrate">vertébré</inlineChoice><inlineChoice identifier="invertebrate">invertébré</inlineChoice><inlineChoice identifier="plant">plante</inlineChoice></inlineChoiceInteraction>.</p>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'match-interaction': {
    title: 'Interaction d\\\'Appariement',
    description: 'Une question d\\\'appariement pour associer les capitales à leurs pays',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="match-interaction.fr-FR"
  title="Interaction d'Appariement"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair">
    <correctResponse>
      <value>capital1 country1</value>
      <value>capital2 country2</value>
      <value>capital3 country3</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="capital1 country1" mappedValue="1"/>
      <mapEntry mapKey="capital2 country2" mappedValue="1"/>
      <mapEntry mapKey="capital3 country3" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>3.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Associez les capitales à leurs pays:</p>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="3">
      <prompt>Sélectionnez les paires correspondantes</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="capital1" matchMax="1">Paris</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital2" matchMax="1">Londres</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital3" matchMax="1">Berlin</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="country1" matchMax="1">France</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country2" matchMax="1">Angleterre</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country3" matchMax="1">Allemagne</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'order-interaction': {
    title: 'Interaction d\\\'Ordre',
    description: 'Une question d\\\'ordonnancement sur la méthode scientifique',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="order-interaction.fr-FR"
  title="Interaction d'Ordre"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>ChoiceA</value>
      <value>ChoiceB</value>
      <value>ChoiceC</value>
      <value>ChoiceD</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>2.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Disposez les étapes suivantes de la méthode scientifique dans le bon ordre:</p>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
      <prompt>Faites glisser les éléments pour les ordonner</prompt>
      <simpleChoice identifier="ChoiceA">Poser une question</simpleChoice>
      <simpleChoice identifier="ChoiceB">Effectuer des recherches</simpleChoice>
      <simpleChoice identifier="ChoiceC">Formuler une hypothèse</simpleChoice>
      <simpleChoice identifier="ChoiceD">Tester l'hypothèse</simpleChoice>
    </orderInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">2.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'partial-credit': {
    title: 'Question avec Crédit Partiel',
    description: 'Une question à choix multiples avec notation partielle sur la photosynthèse',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="partial-credit.fr-FR"
  title="Question avec Crédit Partiel"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceA</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="ChoiceA" mappedValue="3"/>
      <mapEntry mapKey="ChoiceB" mappedValue="2"/>
      <mapEntry mapKey="ChoiceC" mappedValue="1"/>
      <mapEntry mapKey="ChoiceD" mappedValue="0"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>3.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Laquelle des descriptions suivantes est la MEILLEURE description de la photosynthèse?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Sélectionnez votre réponse:</prompt>
      <simpleChoice identifier="ChoiceA">Le processus par lequel les plantes convertissent l'énergie lumineuse en énergie chimique</simpleChoice>
      <simpleChoice identifier="ChoiceB">Le processus par lequel les plantes produisent de la nourriture</simpleChoice>
      <simpleChoice identifier="ChoiceC">Le processus impliquant les plantes et la lumière du soleil</simpleChoice>
      <simpleChoice identifier="ChoiceD">Le processus où les plantes poussent</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'simple-choice': {
    title: 'Choix Multiple Simple',
    description: 'Une question simple à choix multiples sur la soustraction',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="simple-choice.fr-FR"
  title="Choix Multiple Simple"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceA</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Si Maya a 12 biscuits et en donne 5 à son amie, combien de biscuits lui reste-t-il?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Sélectionnez la bonne réponse:</prompt>
      <simpleChoice identifier="ChoiceA">7</simpleChoice>
      <simpleChoice identifier="ChoiceB">17</simpleChoice>
      <simpleChoice identifier="ChoiceC">5</simpleChoice>
      <simpleChoice identifier="ChoiceD">8</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'slider-interaction': {
    title: 'Interaction de Curseur',
    description: 'Une question à curseur sur la couverture en eau de la Terre',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="slider-interaction.fr-FR"
  title="Interaction de Curseur"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
    <correctResponse>
      <value>75</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="75" mappedValue="3"/>
      <mapEntry mapKey="74" mappedValue="2.5"/>
      <mapEntry mapKey="76" mappedValue="2.5"/>
      <mapEntry mapKey="73" mappedValue="2"/>
      <mapEntry mapKey="77" mappedValue="2"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>3.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Approximativement quel pourcentage de la surface de la Terre est couvert par l'eau?</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="100" step="1">
      <prompt>Utilisez le curseur pour sélectionner un pourcentage</prompt>
    </sliderInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'text-entry': {
    title: 'Question à Réponse Courte',
    description: 'Une question à compléter sur la photosynthèse',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="text-entry.fr-FR"
  title="Question à Réponse Courte"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>photosynthèse</value>
    </correctResponse>
    <mapping defaultValue="0" caseSensitive="false">
      <mapEntry mapKey="photosynthèse" mappedValue="2" caseSensitive="false"/>
      <mapEntry mapKey="photosynthese" mappedValue="2" caseSensitive="false"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>2.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Complétez la phrase: Le processus par lequel les plantes convertissent l'énergie lumineuse en énergie chimique s'appelle la <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="15"/>.</p>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'graphic-gap-match-solar-system': {
    title: 'Système Solaire - Étiqueter les Planètes',
    description: 'Une interaction de correspondance graphique pour étiqueter les planètes intérieures',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-solar-system.fr-FR"
  title="Système Solaire - Étiqueter les Planètes"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>MERCURY A</value>
      <value>VENUS B</value>
      <value>EARTH C</value>
      <value>MARS D</value>
    </correctResponse>
    <mapping lowerBound="0" defaultValue="0">
      <mapEntry mapKey="MERCURY A" mappedValue="1"/>
      <mapEntry mapKey="VENUS B" mappedValue="1"/>
      <mapEntry mapKey="EARTH C" mappedValue="1"/>
      <mapEntry mapKey="MARS D" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>4.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Les planètes intérieures de notre système solaire sont les quatre planètes rocheuses les plus proches du Soleil : Mercure, Vénus, la Terre et Mars.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>Étiquetez les quatre planètes intérieures de notre système solaire</prompt>
      <object type="image/svg+xml" width="800" height="400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
          <defs>
            <radialGradient id="sunGradient">
              <stop offset="0%" style="stop-color:#FDB813;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#F15A24;stop-opacity:0.8" />
            </radialGradient>
            <radialGradient id="mercuryGrad">
              <stop offset="30%" style="stop-color:#B7B8B9;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8B8C8D;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="venusGrad">
              <stop offset="30%" style="stop-color:#E8CDA2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C49A6C;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="earthGrad">
              <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#4A90E2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#2E5C8A;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="marsGrad">
              <stop offset="30%" style="stop-color:#E27B58;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C1440E;stop-opacity:1" />
            </radialGradient>
          </defs>
          <rect width="800" height="400" fill="#0a0e27"/>
          <circle cx="50" cy="50" r="1" fill="white" opacity="0.8"/>
          <circle cx="120" cy="30" r="1" fill="white" opacity="0.6"/>
          <circle cx="200" cy="80" r="1.5" fill="white" opacity="0.9"/>
          <circle cx="350" cy="40" r="1" fill="white" opacity="0.7"/>
          <circle cx="450" cy="70" r="1" fill="white" opacity="0.6"/>
          <circle cx="550" cy="50" r="1.5" fill="white" opacity="0.8"/>
          <circle cx="650" cy="90" r="1" fill="white" opacity="0.7"/>
          <circle cx="720" cy="60" r="1" fill="white" opacity="0.9"/>
          <circle cx="100" cy="350" r="1" fill="white" opacity="0.8"/>
          <circle cx="300" cy="370" r="1.5" fill="white" opacity="0.7"/>
          <circle cx="500" cy="340" r="1" fill="white" opacity="0.9"/>
          <circle cx="700" cy="360" r="1" fill="white" opacity="0.6"/>
          <circle cx="30" cy="200" r="45" fill="url(#sunGradient)" opacity="0.9"/>
          <circle cx="30" cy="200" r="50" fill="none" stroke="#FDB813" stroke-width="1" opacity="0.3"/>
          <text x="30" y="270" font-size="12" fill="#FDB813" text-anchor="middle" font-family="Arial, sans-serif">Soleil</text>
          <circle cx="150" cy="200" r="18" fill="url(#mercuryGrad)"/>
          <text x="150" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">?</text>
          <circle cx="280" cy="200" r="28" fill="url(#venusGrad)"/>
          <text x="280" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">?</text>
          <circle cx="430" cy="200" r="30" fill="url(#earthGrad)"/>
          <path d="M 425,185 Q 435,180 445,185 L 450,195 Q 445,200 435,198 Z" fill="#2d5016" opacity="0.7"/>
          <path d="M 410,200 Q 415,195 425,200 L 425,210 Q 420,212 410,208 Z" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="435" cy="210" rx="8" ry="5" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="445" cy="195" rx="6" ry="3" fill="white" opacity="0.5"/>
          <ellipse cx="415" cy="205" rx="5" ry="2.5" fill="white" opacity="0.5"/>
          <text x="430" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">?</text>
          <circle cx="580" cy="200" r="24" fill="url(#marsGrad)"/>
          <circle cx="575" cy="185" r="5" fill="white" opacity="0.6"/>
          <text x="580" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">?</text>
          <circle cx="30" cy="200" r="120" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="250" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="400" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="550" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <text x="400" y="30" font-size="20" font-weight="bold" fill="white" text-anchor="middle">Planètes Intérieures du Système Solaire</text>
        </svg>
      </object>
      <gapText identifier="MERCURY" matchMax="1">Mercure</gapText>
      <gapText identifier="VENUS" matchMax="1">Vénus</gapText>
      <gapText identifier="EARTH" matchMax="1">Terre</gapText>
      <gapText identifier="MARS" matchMax="1">Mars</gapText>
      <associableHotspot identifier="A" matchMax="1" shape="circle" coords="150,320,30"/>
      <associableHotspot identifier="B" matchMax="1" shape="circle" coords="280,320,30"/>
      <associableHotspot identifier="C" matchMax="1" shape="circle" coords="430,320,30"/>
      <associableHotspot identifier="D" matchMax="1" shape="circle" coords="580,320,30"/>
    </graphicGapMatchInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'hotspot-interaction': {
    title: 'Interaction Hotspot - Système Solaire',
    description: 'Une question hotspot pour identifier la Terre parmi les planètes',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hotspot-interaction.fr-FR"
  title="Interaction Hotspot - Système Solaire"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>EARTH</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Question d'Astronomie:</strong> Quelle planète de notre système solaire est connue comme la "Planète Bleue" en raison de son eau abondante?</p>
    <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Cliquez sur la planète qui a de l'eau liquide couvrant la majeure partie de sa surface</prompt>
      <object type="image/svg+xml" width="800" height="400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
          <defs>
            <radialGradient id="sunGradient">
              <stop offset="0%" style="stop-color:#FDB813;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#F15A24;stop-opacity:0.8" />
            </radialGradient>
            <radialGradient id="mercuryGrad">
              <stop offset="30%" style="stop-color:#B7B8B9;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8B8C8D;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="venusGrad">
              <stop offset="30%" style="stop-color:#E8CDA2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C49A6C;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="earthGrad">
              <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#4A90E2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#2E5C8A;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="marsGrad">
              <stop offset="30%" style="stop-color:#E27B58;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C1440E;stop-opacity:1" />
            </radialGradient>
          </defs>
          <rect width="800" height="400" fill="#0a0e27"/>
          <circle cx="50" cy="50" r="1" fill="white" opacity="0.8"/>
          <circle cx="120" cy="30" r="1" fill="white" opacity="0.6"/>
          <circle cx="200" cy="80" r="1.5" fill="white" opacity="0.9"/>
          <circle cx="350" cy="40" r="1" fill="white" opacity="0.7"/>
          <circle cx="450" cy="70" r="1" fill="white" opacity="0.6"/>
          <circle cx="550" cy="50" r="1.5" fill="white" opacity="0.8"/>
          <circle cx="650" cy="90" r="1" fill="white" opacity="0.7"/>
          <circle cx="720" cy="60" r="1" fill="white" opacity="0.9"/>
          <circle cx="100" cy="350" r="1" fill="white" opacity="0.8"/>
          <circle cx="300" cy="370" r="1.5" fill="white" opacity="0.7"/>
          <circle cx="500" cy="340" r="1" fill="white" opacity="0.9"/>
          <circle cx="700" cy="360" r="1" fill="white" opacity="0.6"/>
          <circle cx="30" cy="200" r="45" fill="url(#sunGradient)" opacity="0.9"/>
          <circle cx="30" cy="200" r="50" fill="none" stroke="#FDB813" stroke-width="1" opacity="0.3"/>
          <circle cx="150" cy="200" r="18" fill="url(#mercuryGrad)"/>
          <text x="150" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">Mercure</text>
          <circle cx="280" cy="200" r="28" fill="url(#venusGrad)"/>
          <text x="280" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">Vénus</text>
          <circle cx="430" cy="200" r="30" fill="url(#earthGrad)"/>
          <path d="M 425,185 Q 435,180 445,185 L 450,195 Q 445,200 435,198 Z" fill="#2d5016" opacity="0.7"/>
          <path d="M 410,200 Q 415,195 425,200 L 425,210 Q 420,212 410,208 Z" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="435" cy="210" rx="8" ry="5" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="445" cy="195" rx="6" ry="3" fill="white" opacity="0.5"/>
          <ellipse cx="415" cy="205" rx="5" ry="2.5" fill="white" opacity="0.5"/>
          <text x="430" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">Terre</text>
          <circle cx="580" cy="200" r="24" fill="url(#marsGrad)"/>
          <circle cx="575" cy="185" r="5" fill="white" opacity="0.6"/>
          <text x="580" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">Mars</text>
          <circle cx="30" cy="200" r="120" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="250" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="400" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="550" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
        </svg>
      </object>
      <hotspotChoice identifier="MERCURY" shape="circle" coords="150,200,25"/>
      <hotspotChoice identifier="VENUS" shape="circle" coords="280,200,35"/>
      <hotspotChoice identifier="EARTH" shape="circle" coords="430,200,35"/>
      <hotspotChoice identifier="MARS" shape="circle" coords="580,200,30"/>
    </hotspotInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'drawing-interaction': {
    title: 'Interaction de Dessin',
    description: 'Une question de dessin pour créer une ligne sur le canevas',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="drawing-interaction.fr-FR"
  title="Interaction de Dessin"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="DRAW" cardinality="single" baseType="file"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Dessin:</strong> Dessinez une ligne sur le canevas.</p>
    <drawingInteraction responseIdentifier="DRAW" data-stroke-color="#2563eb" data-line-width="5">
      <object type="image/svg+xml" width="500" height="300">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
          <rect x="0" y="0" width="500" height="300" fill="#ffffff"/>
        </svg>
      </object>
    </drawingInteraction>
  </itemBody>
</assessmentItem>`,
  },
  'hottext-multiple': {
    title: 'Interaction de Texte Cliquable - Sélection Multiple',
    description: 'Une question de texte cliquable pour distinguer les faits des opinions',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-multiple.fr-FR"
  title="Interaction de Texte Cliquable - Sélection Multiple"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse>
      <value>H2</value>
      <value>H4</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Compréhension de Lecture:</strong> Sélectionnez toutes les affirmations qui sont des faits (pas des opinions).</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="3">
      <prompt>Sélectionnez les déclarations factuelles:</prompt>
      <p><hottext identifier="H1">L'été est la meilleure saison</hottext></p>
      <p><hottext identifier="H2">L'eau bout à 100°C au niveau de la mer</hottext></p>
      <p><hottext identifier="H3">La musique classique est plus sophistiquée que la pop</hottext></p>
      <p><hottext identifier="H4">La Terre orbite autour du Soleil</hottext></p>
    </hottextInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  },
  'graphic-order': {
    title: 'Interaction d\\\'Ordre Graphique',
    description: 'Une question d\\\'ordre graphique sur les couches géologiques',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="graphic-order.fr-FR"
  title="Interaction d'Ordre Graphique">
  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>BEDROCK</value>
      <value>SEDIMENTARY</value>
      <value>TOPSOIL</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p><strong>Géologie:</strong> Disposez les couches géologiques de bas en haut.</p>
    <graphicOrderInteraction responseIdentifier="RESPONSE">
      <prompt>Faites glisser pour réordonner correctement les couches:</prompt>
      <object type="image/png" data="/sample-geolayers.png" width="600" height="350">
        Diagramme en coupe transversale des couches géologiques
      </object>
      <hotspotChoice identifier="TOPSOIL" shape="rect" coords="0,0,100,50">Terre Arable</hotspotChoice>
      <hotspotChoice identifier="SEDIMENTARY" shape="rect" coords="0,0,100,50">Roche Sédimentaire</hotspotChoice>
      <hotspotChoice identifier="BEDROCK" shape="rect" coords="0,0,100,50">Roche Mère</hotspotChoice>
    </graphicOrderInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
  }
};
