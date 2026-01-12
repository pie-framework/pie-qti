/**
 * Sample QTI Items - ar-SA
 *
 * This file contains ar-SA translations of sample QTI assessment items.
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
 * ar-SA translations of sample items
 *
 * Each key corresponds to a base item identifier, with the localized content
 * including title, description, and QTI XML.
 */
export const ITEMS_AR_SA: Record<string, LocalizedItemData> = {
  'capital-cities': {
    title: 'المدن العواصم',
    description: 'سؤال اختيار متعدد عن عواصم العالم',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="capital-cities.ar-SA"
  title="المدن العواصم"
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
    <p>ما هي عاصمة فرنسا؟</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <prompt>اختر المدينة الصحيحة:</prompt>
      <simpleChoice identifier="paris">باريس</simpleChoice>
      <simpleChoice identifier="london">لندن</simpleChoice>
      <simpleChoice identifier="berlin">برلين</simpleChoice>
      <simpleChoice identifier="madrid">مدريد</simpleChoice>
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
    title: 'إجابة نصية موسعة',
    description: 'سؤال مفتوح عن علم الأحياء الخلوية يتطلب تقييماً يدوياً',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="extended-text.ar-SA"
  title="إجابة نصية موسعة"
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
    <h3>معايير التقييم</h3>
    <p><strong>٤ نقاط:</strong> يحدد الميتوكوندريا كموقع للتنفس الخلوي، يشرح إنتاج ATP، يذكر تحويل المواد الغذائية إلى طاقة قابلة للاستخدام، يستخدم مصطلحات دقيقة.</p>
    <p><strong>٣ نقاط:</strong> يحدد دور الميتوكوندريا في إنتاج الطاقة، يذكر ATP أو التنفس الخلوي، أخطاء بسيطة أو تفاصيل مفقودة.</p>
    <p><strong>نقطتان:</strong> يحدد بشكل صحيح الميتوكوندريا كعلاقة بالطاقة، شرح غامض أو غير مكتمل.</p>
    <p><strong>نقطة واحدة:</strong> يظهر فهماً ضئيلاً، معلومات غير صحيحة أو غير ذات صلة مع بعض العناصر الصحيحة.</p>
    <p><strong>صفر نقطة:</strong> عدم وجود إجابة أو إجابة خاطئة تماماً.</p>
  </rubricBlock>

  <rubricBlock view="candidate">
    <p><em>سيتم تقييم إجابتك من قبل المعلم بناءً على الدقة العلمية والاكتمال. تأكد من شرح الوظيفة المحددة للميتوكوندريا في العمليات الخلوية.</em></p>
  </rubricBlock>

  <itemBody>
    <p>اشرح دور الميتوكوندريا في وظيفة الخلية.</p>
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
    title: 'سؤال نص قابل للنقر - اختيار واحد',
    description: 'سؤال نص قابل للنقر لتحديد أجزاء الكلام',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-single.ar-SA"
  title="سؤال نص قابل للنقر - اختيار واحد"
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
    <p><strong>النحو:</strong> اختر الكلمة التي تمثل الفعل في الجملة التالية.</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>انقر على الفعل:</prompt>
      <p><hottext identifier="H1">القط</hottext> <hottext identifier="H2">يقفز</hottext> فوق <hottext identifier="H3">السياج</hottext>.</p>
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
    title: 'سؤال اختيار مضمّن',
    description: 'سؤال ملء الفراغ عن تصنيف الحيوانات',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="inline-choice.ar-SA"
  title="سؤال اختيار مضمّن"
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
    <p>الكلب هو حيوان <inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false"><inlineChoice identifier="vertebrate">فقاري</inlineChoice><inlineChoice identifier="invertebrate">لافقاري</inlineChoice><inlineChoice identifier="plant">نبات</inlineChoice></inlineChoiceInteraction>.</p>
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
    title: 'سؤال مطابقة',
    description: 'سؤال مطابقة لربط العواصم بدولها',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="match-interaction.ar-SA"
  title="سؤال مطابقة"
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
    <p>طابق العواصم مع دولها:</p>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="3">
      <prompt>اختر الأزواج المتطابقة</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="capital1" matchMax="1">باريس</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital2" matchMax="1">لندن</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital3" matchMax="1">برلين</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="country1" matchMax="1">فرنسا</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country2" matchMax="1">إنجلترا</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country3" matchMax="1">ألمانيا</simpleAssociableChoice>
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
    title: 'سؤال ترتيب',
    description: 'سؤال ترتيب عن خطوات المنهج العلمي',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="order-interaction.ar-SA"
  title="سؤال ترتيب"
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
    <p>رتب الخطوات التالية للمنهج العلمي بالترتيب الصحيح:</p>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
      <prompt>اسحب العناصر لترتيبها</prompt>
      <simpleChoice identifier="ChoiceA">طرح سؤال</simpleChoice>
      <simpleChoice identifier="ChoiceB">إجراء البحث</simpleChoice>
      <simpleChoice identifier="ChoiceC">صياغة فرضية</simpleChoice>
      <simpleChoice identifier="ChoiceD">اختبار الفرضية</simpleChoice>
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
    title: 'سؤال بدرجة جزئية',
    description: 'سؤال اختيار متعدد بتقييم جزئي عن عملية التمثيل الضوئي',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="partial-credit.ar-SA"
  title="سؤال بدرجة جزئية"
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
    <p>أي مما يلي هو أفضل وصف لعملية التمثيل الضوئي؟</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>اختر إجابتك:</prompt>
      <simpleChoice identifier="ChoiceA">العملية التي تحول بها النباتات الطاقة الضوئية إلى طاقة كيميائية</simpleChoice>
      <simpleChoice identifier="ChoiceB">العملية التي تصنع بها النباتات الغذاء</simpleChoice>
      <simpleChoice identifier="ChoiceC">العملية التي تشمل النباتات وضوء الشمس</simpleChoice>
      <simpleChoice identifier="ChoiceD">العملية التي تنمو بها النباتات</simpleChoice>
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
    title: 'اختيار متعدد بسيط',
    description: 'سؤال اختيار متعدد بسيط عن الطرح',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="simple-choice.ar-SA"
  title="اختيار متعدد بسيط"
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
    <p>إذا كان لدى مايا ١٢ قطعة بسكويت وأعطت ٥ قطع لصديقتها، كم قطعة بسكويت تبقى لديها؟</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>اختر الإجابة الصحيحة:</prompt>
      <simpleChoice identifier="ChoiceA">٧</simpleChoice>
      <simpleChoice identifier="ChoiceB">١٧</simpleChoice>
      <simpleChoice identifier="ChoiceC">٥</simpleChoice>
      <simpleChoice identifier="ChoiceD">٨</simpleChoice>
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
    title: 'سؤال شريط التمرير',
    description: 'سؤال شريط تمرير عن نسبة تغطية الأرض بالماء',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="slider-interaction.ar-SA"
  title="سؤال شريط التمرير"
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
    <p>ما هي النسبة المئوية التقريبية لسطح الأرض المغطى بالمياه؟</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="100" step="1">
      <prompt>استخدم شريط التمرير لتحديد النسبة المئوية</prompt>
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
    title: 'سؤال إدخال نصي',
    description: 'سؤال ملء الفراغ عن عملية التمثيل الضوئي',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="text-entry.ar-SA"
  title="سؤال إدخال نصي"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>التمثيل الضوئي</value>
    </correctResponse>
    <mapping defaultValue="0" caseSensitive="false">
      <mapEntry mapKey="التمثيل الضوئي" mappedValue="2" caseSensitive="false"/>
      <mapEntry mapKey="البناء الضوئي" mappedValue="2" caseSensitive="false"/>
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
    <p>أكمل الفراغ: العملية التي تحول بها النباتات الطاقة الضوئية إلى طاقة كيميائية تسمى <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="15"/>.</p>
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
    title: 'النظام الشمسي - تسمية الكواكب',
    description: 'تفاعل مطابقة رسومية لتسمية الكواكب الداخلية',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-solar-system.ar-SA"
  title="النظام الشمسي - تسمية الكواكب"
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
    <p>الكواكب الداخلية لنظامنا الشمسي هي الكواكب الصخرية الأربعة الأقرب إلى الشمس: عطارد، الزهرة، الأرض، والمريخ.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>ضع اسم الكواكب الداخلية الأربعة في نظامنا الشمسي</prompt>
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
          <text x="30" y="270" font-size="12" fill="#FDB813" text-anchor="middle" font-family="Arial, sans-serif">الشمس</text>
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
          <text x="400" y="30" font-size="20" font-weight="bold" fill="white" text-anchor="middle">الكواكب الداخلية للنظام الشمسي</text>
        </svg>
      </object>
      <gapText identifier="MERCURY" matchMax="1">عطارد</gapText>
      <gapText identifier="VENUS" matchMax="1">الزهرة</gapText>
      <gapText identifier="EARTH" matchMax="1">الأرض</gapText>
      <gapText identifier="MARS" matchMax="1">المريخ</gapText>
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
    title: 'تفاعل النقاط الساخنة - النظام الشمسي',
    description: 'سؤال نقطة ساخنة لتحديد الأرض بين الكواكب',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hotspot-interaction.ar-SA"
  title="تفاعل النقاط الساخنة - النظام الشمسي"
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
    <p><strong>سؤال فلكي:</strong> أي كوكب في نظامنا الشمسي يُعرف باسم "الكوكب الأزرق" بسبب وفرة المياه فيه؟</p>
    <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>انقر على الكوكب الذي تغطي المياه السائلة معظم سطحه</prompt>
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
          <text x="150" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">عطارد</text>
          <circle cx="280" cy="200" r="28" fill="url(#venusGrad)"/>
          <text x="280" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">الزهرة</text>
          <circle cx="430" cy="200" r="30" fill="url(#earthGrad)"/>
          <path d="M 425,185 Q 435,180 445,185 L 450,195 Q 445,200 435,198 Z" fill="#2d5016" opacity="0.7"/>
          <path d="M 410,200 Q 415,195 425,200 L 425,210 Q 420,212 410,208 Z" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="435" cy="210" rx="8" ry="5" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="445" cy="195" rx="6" ry="3" fill="white" opacity="0.5"/>
          <ellipse cx="415" cy="205" rx="5" ry="2.5" fill="white" opacity="0.5"/>
          <text x="430" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">الأرض</text>
          <circle cx="580" cy="200" r="24" fill="url(#marsGrad)"/>
          <circle cx="575" cy="185" r="5" fill="white" opacity="0.6"/>
          <text x="580" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">المريخ</text>
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
    title: 'تفاعل الرسم',
    description: 'سؤال رسم لإنشاء خط على اللوحة',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="drawing-interaction.ar-SA"
  title="تفاعل الرسم"
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
    <p><strong>الرسم:</strong> ارسم خطًا على اللوحة.</p>
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
    title: 'تفاعل النص القابل للنقر - اختيار متعدد',
    description: 'سؤال نص قابل للنقر للتمييز بين الحقائق والآراء',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-multiple.ar-SA"
  title="تفاعل النص القابل للنقر - اختيار متعدد"
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
    <p><strong>فهم القراءة:</strong> اختر جميع العبارات التي تمثل حقائق (وليست آراء).</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="3">
      <prompt>اختر العبارات الواقعية:</prompt>
      <p><hottext identifier="H1">الصيف هو أفضل موسم</hottext></p>
      <p><hottext identifier="H2">يغلي الماء عند 100 درجة مئوية عند مستوى سطح البحر</hottext></p>
      <p><hottext identifier="H3">الموسيقى الكلاسيكية أكثر تطورًا من موسيقى البوب</hottext></p>
      <p><hottext identifier="H4">الأرض تدور حول الشمس</hottext></p>
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
    title: 'تفاعل الترتيب الرسومي',
    description: 'سؤال ترتيب رسومي حول الطبقات الجيولوجية',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="graphic-order.ar-SA"
  title="تفاعل الترتيب الرسومي">
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
    <p><strong>الجيولوجيا:</strong> رتب الطبقات الجيولوجية من الأسفل إلى الأعلى.</p>
    <graphicOrderInteraction responseIdentifier="RESPONSE">
      <prompt>اسحب لإعادة ترتيب الطبقات بشكل صحيح:</prompt>
      <object type="image/png" data="/sample-geolayers.png" width="600" height="350">
        مقطع عرضي للطبقات الجيولوجية
      </object>
      <hotspotChoice identifier="TOPSOIL" shape="rect" coords="0,0,100,50">التربة السطحية</hotspotChoice>
      <hotspotChoice identifier="SEDIMENTARY" shape="rect" coords="0,0,100,50">الصخور الرسوبية</hotspotChoice>
      <hotspotChoice identifier="BEDROCK" shape="rect" coords="0,0,100,50">الصخر الأساسي</hotspotChoice>
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
