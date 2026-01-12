/**
 * Sample QTI Items - th-TH
 *
 * This file contains th-TH translations of sample QTI assessment items.
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
 * th-TH translations of sample items
 *
 * Each key corresponds to a base item identifier, with the localized content
 * including title, description, and QTI XML.
 */
export const ITEMS_TH_TH: Record<string, LocalizedItemData> = {
  'capital-cities': {
    title: 'เมืองหลวง',
    description: 'คำถามแบบเลือกตอบเกี่ยวกับเมืองหลวงของโลก',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="capital-cities.th-TH"
  title="เมืองหลวง"
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
    <p>เมืองหลวงของประเทศฝรั่งเศสคืออะไร?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <prompt>เลือกเมืองที่ถูกต้อง:</prompt>
      <simpleChoice identifier="paris">ปารีส</simpleChoice>
      <simpleChoice identifier="london">ลอนดอน</simpleChoice>
      <simpleChoice identifier="berlin">เบอร์ลิน</simpleChoice>
      <simpleChoice identifier="madrid">มาดริด</simpleChoice>
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
    title: 'คำตอบข้อความแบบขยาย',
    description: 'คำถามแบบเปิดเกี่ยวกับชีววิทยาของเซลล์ที่ต้องการการตรวจให้คะแนนด้วยตนเอง',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="extended-text.th-TH"
  title="คำตอบข้อความแบบขยาย"
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
    <h3>เกณฑ์การให้คะแนน</h3>
    <p><strong>4 คะแนน:</strong> ระบุไมโทคอนเดรียเป็นสถานที่เกิดการหายใจระดับเซลล์ อธิบายการผลิต ATP กล่าวถึงการเปลี่ยนสารอาหารเป็นพลังงานที่ใช้ได้ ใช้คำศัพท์ที่ถูกต้อง</p>
    <p><strong>3 คะแนน:</strong> ระบุบทบาทของไมโทคอนเดรียในการผลิตพลังงาน กล่าวถึง ATP หรือการหายใจระดับเซลล์ มีความไม่ถูกต้องเล็กน้อยหรือขาดรายละเอียด</p>
    <p><strong>2 คะแนน:</strong> ระบุไมโทคอนเดรียเกี่ยวข้องกับพลังงานได้ถูกต้อง คำอธิบายคลุมเครือหรือไม่สมบูรณ์</p>
    <p><strong>1 คะแนน:</strong> แสดงความเข้าใจขั้นต่ำสุด ข้อมูลไม่ถูกต้องหรือไม่เกี่ยวข้องพร้อมองค์ประกอบที่ถูกต้องบางส่วน</p>
    <p><strong>0 คะแนน:</strong> ไม่มีคำตอบหรือคำตอบไม่ถูกต้องทั้งหมด</p>
  </rubricBlock>

  <rubricBlock view="candidate">
    <p><em>คำตอบของคุณจะได้รับการให้คะแนนโดยผู้สอนของคุณตามความถูกต้องทางวิทยาศาสตร์และความสมบูรณ์ อย่าลืมอธิบายหน้าที่เฉพาะของไมโทคอนเดรียในกระบวนการของเซลล์</em></p>
  </rubricBlock>

  <itemBody>
    <p>อธิบายบทบาทของไมโทคอนเดรียในการทำงานของเซลล์</p>
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
    title: 'การโต้ตอบข้อความคลิกได้ - เลือกตัวเดียว',
    description: 'คำถามข้อความคลิกได้เพื่อระบุชนิดของคำ',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-single.th-TH"
  title="การโต้ตอบข้อความคลิกได้ - เลือกตัวเดียว"
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
    <p><strong>ไวยากรณ์:</strong> เลือกคำที่เป็นกริยาในประโยคต่อไปนี้</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>คลิกที่กริยา:</prompt>
      <p><hottext identifier="H1">แมว</hottext><hottext identifier="H2">กระโดด</hottext>ข้าม<hottext identifier="H3">รั้ว</hottext></p>
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
    title: 'คำถามเลือกตอบในบรรทัด',
    description: 'คำถามเติมคำในช่องว่างเกี่ยวกับการจำแนกสัตว์',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="inline-choice.th-TH"
  title="คำถามเลือกตอบในบรรทัด"
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
    <p>สุนัขเป็นสัตว์<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false"><inlineChoice identifier="vertebrate">มีกระดูกสันหลัง</inlineChoice><inlineChoice identifier="invertebrate">ไม่มีกระดูกสันหลัง</inlineChoice><inlineChoice identifier="plant">พืช</inlineChoice></inlineChoiceInteraction></p>
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
    title: 'การโต้ตอบการจับคู่',
    description: 'คำถามการจับคู่เมืองหลวงกับประเทศของตน',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="match-interaction.th-TH"
  title="การโต้ตอบการจับคู่"
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
    <p>จับคู่เมืองหลวงกับประเทศของตน:</p>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="3">
      <prompt>เลือกคู่ที่ตรงกัน</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="capital1" matchMax="1">ปารีส</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital2" matchMax="1">ลอนดอน</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital3" matchMax="1">เบอร์ลิน</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="country1" matchMax="1">ฝรั่งเศส</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country2" matchMax="1">อังกฤษ</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country3" matchMax="1">เยอรมนี</simpleAssociableChoice>
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
    title: 'การโต้ตอบเรียงลำดับ',
    description: 'คำถามเรียงลำดับเกี่ยวกับวิธีการทางวิทยาศาสตร์',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="order-interaction.th-TH"
  title="การโต้ตอบเรียงลำดับ"
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
    <p>จัดเรียงขั้นตอนต่อไปนี้ของวิธีการทางวิทยาศาสตร์ตามลำดับที่ถูกต้อง:</p>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
      <prompt>ลากรายการเพื่อจัดเรียงตามลำดับ</prompt>
      <simpleChoice identifier="ChoiceA">ตั้งคำถาม</simpleChoice>
      <simpleChoice identifier="ChoiceB">ทำการวิจัย</simpleChoice>
      <simpleChoice identifier="ChoiceC">ตั้งสมมติฐาน</simpleChoice>
      <simpleChoice identifier="ChoiceD">ทดสอบสมมติฐาน</simpleChoice>
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
    title: 'คำถามให้คะแนนบางส่วน',
    description: 'คำถามแบบเลือกตอบที่ให้คะแนนบางส่วนเกี่ยวกับการสังเคราะห์แสง',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="partial-credit.th-TH"
  title="คำถามให้คะแนนบางส่วน"
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
    <p>ข้อใดต่อไปนี้เป็นคำอธิบายที่ดีที่สุดของการสังเคราะห์แสง?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>เลือกคำตอบของคุณ:</prompt>
      <simpleChoice identifier="ChoiceA">กระบวนการที่พืชเปลี่ยนพลังงานแสงเป็นพลังงานเคมี</simpleChoice>
      <simpleChoice identifier="ChoiceB">กระบวนการที่พืชผลิตอาหาร</simpleChoice>
      <simpleChoice identifier="ChoiceC">กระบวนการที่เกี่ยวข้องกับพืชและแสงอาทิตย์</simpleChoice>
      <simpleChoice identifier="ChoiceD">กระบวนการที่พืชเจริญเติบโต</simpleChoice>
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
    title: 'แบบทดสอบเลือกตอบง่าย',
    description: 'คำถามแบบเลือกตอบง่ายๆ เกี่ยวกับการลบ',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="simple-choice.th-TH"
  title="แบบทดสอบเลือกตอบง่าย"
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
    <p>ถ้ามายามีคุกกี้ 12 ชิ้น และแบ่งให้เพื่อน 5 ชิ้น เธอจะเหลือคุกกี้กี่ชิ้น?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>เลือกคำตอบที่ถูกต้อง:</prompt>
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
    title: 'การโต้ตอบตัวเลื่อน',
    description: 'คำถามแบบเลื่อนเกี่ยวกับพื้นที่น้ำที่ปกคลุมโลก',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="slider-interaction.th-TH"
  title="การโต้ตอบตัวเลื่อน"
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
    <p>โดยประมาณพื้นผิวโลกกี่เปอร์เซ็นต์ที่ปกคลุมด้วยน้ำ?</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="100" step="1">
      <prompt>ใช้แถบเลื่อนเพื่อเลือกเปอร์เซ็นต์</prompt>
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
    title: 'คำถามกรอกข้อความ',
    description: 'คำถามเติมคำในช่องว่างเกี่ยวกับการสังเคราะห์แสง',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="text-entry.th-TH"
  title="คำถามกรอกข้อความ"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>การสังเคราะห์แสง</value>
    </correctResponse>
    <mapping defaultValue="0" caseSensitive="false">
      <mapEntry mapKey="การสังเคราะห์แสง" mappedValue="2" caseSensitive="false"/>
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
    <p>เติมคำในช่องว่าง: กระบวนการที่พืชเปลี่ยนพลังงานแสงเป็นพลังงานเคมีเรียกว่า <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="15"/>.</p>
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
    title: 'ระบบสุริยะ - ติดป้ายดาวเคราะห์',
    description: 'การโต้ตอบแบบจับคู่กราฟิกเพื่อติดป้ายดาวเคราะห์ด้านใน',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-solar-system.th-TH"
  title="ระบบสุริยะ - ติดป้ายดาวเคราะห์"
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
    <p>ดาวเคราะห์ด้านในของระบบสุริยะของเราคือดาวเคราะห์หิน 4 ดวงที่ใกล้ดวงอาทิตย์ที่สุด: ดาวพุธ ดาวศุกร์ โลก และดาวอังคาร</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>ติดป้ายดาวเคราะห์ด้านใน 4 ดวงในระบบสุริยะของเรา</prompt>
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
          <text x="30" y="270" font-size="12" fill="#FDB813" text-anchor="middle" font-family="Arial, sans-serif">ดวงอาทิตย์</text>
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
          <text x="400" y="30" font-size="20" font-weight="bold" fill="white" text-anchor="middle">ดาวเคราะห์ด้านในของระบบสุริยะ</text>
        </svg>
      </object>
      <gapText identifier="MERCURY" matchMax="1">ดาวพุธ</gapText>
      <gapText identifier="VENUS" matchMax="1">ดาวศุกร์</gapText>
      <gapText identifier="EARTH" matchMax="1">โลก</gapText>
      <gapText identifier="MARS" matchMax="1">ดาวอังคาร</gapText>
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
    title: 'การโต้ตอบจุดร้อน - ระบบสุริยะ',
    description: 'คำถามจุดร้อนเพื่อระบุโลกท่ามกลางดาวเคราะห์',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hotspot-interaction.th-TH"
  title="การโต้ตอบจุดร้อน - ระบบสุริยะ"
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
    <p><strong>คำถามดาราศาสตร์:</strong> ดาวเคราะห์ใดในระบบสุริยะของเราที่เรียกว่า "ดาวเคราะห์สีน้ำเงิน" เพราะมีน้ำมากมาย?</p>
    <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>คลิกที่ดาวเคราะห์ที่มีน้ำในสถานะของเหลวปกคลุมพื้นผิวส่วนใหญ่</prompt>
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
          <text x="150" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">ดาวพุธ</text>
          <circle cx="280" cy="200" r="28" fill="url(#venusGrad)"/>
          <text x="280" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">ดาวศุกร์</text>
          <circle cx="430" cy="200" r="30" fill="url(#earthGrad)"/>
          <path d="M 425,185 Q 435,180 445,185 L 450,195 Q 445,200 435,198 Z" fill="#2d5016" opacity="0.7"/>
          <path d="M 410,200 Q 415,195 425,200 L 425,210 Q 420,212 410,208 Z" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="435" cy="210" rx="8" ry="5" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="445" cy="195" rx="6" ry="3" fill="white" opacity="0.5"/>
          <ellipse cx="415" cy="205" rx="5" ry="2.5" fill="white" opacity="0.5"/>
          <text x="430" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">โลก</text>
          <circle cx="580" cy="200" r="24" fill="url(#marsGrad)"/>
          <circle cx="575" cy="185" r="5" fill="white" opacity="0.6"/>
          <text x="580" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">ดาวอังคาร</text>
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
    title: 'การโต้ตอบการวาดภาพ',
    description: 'คำถามการวาดภาพเพื่อสร้างเส้นบนผืนผ้าใบ',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="drawing-interaction.th-TH"
  title="การโต้ตอบการวาดภาพ"
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
    <p><strong>การวาดภาพ:</strong> วาดเส้นบนผืนผ้าใบ</p>
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
    title: 'การโต้ตอบข้อความที่คลิกได้ - การเลือกหลายรายการ',
    description: 'คำถามข้อความที่คลิกได้เพื่อแยกข้อเท็จจริงจากความคิดเห็น',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-multiple.th-TH"
  title="การโต้ตอบข้อความที่คลิกได้ - การเลือกหลายรายการ"
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
    <p><strong>การอ่านเพื่อความเข้าใจ:</strong> เลือกข้อความทั้งหมดที่เป็นข้อเท็จจริง (ไม่ใช่ความคิดเห็น)</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="3">
      <prompt>เลือกข้อความที่เป็นข้อเท็จจริง:</prompt>
      <p><hottext identifier="H1">ฤดูร้อนเป็นฤดูกาลที่ดีที่สุด</hottext></p>
      <p><hottext identifier="H2">น้ำเดือดที่ 100°C ที่ระดับน้ำทะเล</hottext></p>
      <p><hottext identifier="H3">ดนตรีคลาสสิกมีความซับซ้อนมากกว่าดนตรีป๊อป</hottext></p>
      <p><hottext identifier="H4">โลกโคจรรอบดวงอาทิตย์</hottext></p>
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
    title: 'การโต้ตอบลำดับกราฟิก',
    description: 'คำถามลำดับกราฟิกเกี่ยวกับชั้นธรณีวิทยา',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="graphic-order.th-TH"
  title="การโต้ตอบลำดับกราฟิก">
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
    <p><strong>ธรณีวิทยา:</strong> จัดเรียงชั้นธรณีวิทยาตามลำดับจากล่างขึ้นบน</p>
    <graphicOrderInteraction responseIdentifier="RESPONSE">
      <prompt>ลากเพื่อจัดเรียงชั้นอย่างถูกต้อง:</prompt>
      <object type="image/png" data="/sample-geolayers.png" width="600" height="350">
        แผนภาพตัดขวางชั้นธรณีวิทยา
      </object>
      <hotspotChoice identifier="TOPSOIL" shape="rect" coords="0,0,100,50">ดินชั้นบน</hotspotChoice>
      <hotspotChoice identifier="SEDIMENTARY" shape="rect" coords="0,0,100,50">หินตะกอน</hotspotChoice>
      <hotspotChoice identifier="BEDROCK" shape="rect" coords="0,0,100,50">หินแม่</hotspotChoice>
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
