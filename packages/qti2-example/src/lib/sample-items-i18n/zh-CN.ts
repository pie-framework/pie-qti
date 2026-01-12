/**
 * Sample QTI Items - zh-CN
 *
 * This file contains zh-CN translations of sample QTI assessment items.
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
 * zh-CN translations of sample items
 *
 * Each key corresponds to a base item identifier, with the localized content
 * including title, description, and QTI XML.
 */
export const ITEMS_ZH_CN: Record<string, LocalizedItemData> = {
  'capital-cities': {
    title: '首都城市',
    description: '一道关于世界首都的选择题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="capital-cities.zh-CN"
  title="首都城市"
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
    <p>法国的首都是什么？</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <prompt>选择正确的城市：</prompt>
      <simpleChoice identifier="paris">巴黎</simpleChoice>
      <simpleChoice identifier="london">伦敦</simpleChoice>
      <simpleChoice identifier="berlin">柏林</simpleChoice>
      <simpleChoice identifier="madrid">马德里</simpleChoice>
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
    title: '扩展文本回答题',
    description: '一道关于细胞生物学的开放式问题，需要人工评分',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="extended-text.zh-CN"
  title="扩展文本回答题"
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
    <h3>评分标准</h3>
    <p><strong>4分：</strong>指出线粒体是细胞呼吸的场所，解释ATP的产生，提到将营养物质转化为可用能量，使用准确的术语。</p>
    <p><strong>3分：</strong>指出线粒体在能量产生中的作用，提到ATP或细胞呼吸，有轻微的不准确或遗漏细节。</p>
    <p><strong>2分：</strong>正确指出线粒体与能量相关，解释模糊或不完整。</p>
    <p><strong>1分：</strong>显示出最低限度的理解，信息不正确或不相关但包含一些正确的要素。</p>
    <p><strong>0分：</strong>没有回答或完全错误的回答。</p>
  </rubricBlock>

  <rubricBlock view="candidate">
    <p><em>你的回答将由老师根据科学准确性和完整性进行评分。请务必解释线粒体在细胞过程中的具体功能。</em></p>
  </rubricBlock>

  <itemBody>
    <p>解释线粒体在细胞功能中的作用。</p>
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
    title: '热文本题 - 单选',
    description: '一道识别词性的热文本题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-single.zh-CN"
  title="热文本题 - 单选"
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
    <p><strong>语法：</strong>在下面的句子中选择动词。</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>点击动词：</prompt>
      <p><hottext identifier="H1">猫</hottext><hottext identifier="H2">跳过</hottext><hottext identifier="H3">栅栏</hottext>。</p>
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
    title: '内联选择题',
    description: '一道关于动物分类的填空选择题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="inline-choice.zh-CN"
  title="内联选择题"
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
    <p>狗是一种<inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false"><inlineChoice identifier="vertebrate">脊椎动物</inlineChoice><inlineChoice identifier="invertebrate">无脊椎动物</inlineChoice><inlineChoice identifier="plant">植物</inlineChoice></inlineChoiceInteraction>。</p>
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
    title: '配对题',
    description: '一道将首都与国家配对的题目',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="match-interaction.zh-CN"
  title="配对题"
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
    <p>将首都与其国家配对：</p>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="3">
      <prompt>选择匹配的配对</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="capital1" matchMax="1">巴黎</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital2" matchMax="1">伦敦</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital3" matchMax="1">柏林</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="country1" matchMax="1">法国</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country2" matchMax="1">英国</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country3" matchMax="1">德国</simpleAssociableChoice>
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
    title: '排序题',
    description: '一道关于科学方法的排序题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="order-interaction.zh-CN"
  title="排序题"
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
    <p>按正确顺序排列以下科学方法的步骤：</p>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
      <prompt>拖动项目以排列顺序</prompt>
      <simpleChoice identifier="ChoiceA">提出问题</simpleChoice>
      <simpleChoice identifier="ChoiceB">开展研究</simpleChoice>
      <simpleChoice identifier="ChoiceC">建立假设</simpleChoice>
      <simpleChoice identifier="ChoiceD">验证假设</simpleChoice>
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
    title: '部分评分题',
    description: '一道关于光合作用的部分评分选择题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="partial-credit.zh-CN"
  title="部分评分题"
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
    <p>以下哪个选项是对光合作用的最佳描述？</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>选择你的答案：</prompt>
      <simpleChoice identifier="ChoiceA">植物将光能转化为化学能的过程</simpleChoice>
      <simpleChoice identifier="ChoiceB">植物制造食物的过程</simpleChoice>
      <simpleChoice identifier="ChoiceC">涉及植物和阳光的过程</simpleChoice>
      <simpleChoice identifier="ChoiceD">植物生长的过程</simpleChoice>
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
    title: '简单选择题',
    description: '一道关于减法的简单选择题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="simple-choice.zh-CN"
  title="简单选择题"
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
    <p>如果玛雅有12块饼干，给了她的朋友5块，她还剩下多少块饼干？</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>选择正确答案：</prompt>
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
    title: '滑块题',
    description: '一道关于地球水覆盖率的滑块题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="slider-interaction.zh-CN"
  title="滑块题"
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
    <p>地球表面大约有百分之几被水覆盖？</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="100" step="1">
      <prompt>使用滑块选择百分比</prompt>
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
    title: '文本输入题',
    description: '一道关于光合作用的填空题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="text-entry.zh-CN"
  title="文本输入题"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>光合作用</value>
    </correctResponse>
    <mapping defaultValue="0" caseSensitive="false">
      <mapEntry mapKey="光合作用" mappedValue="2" caseSensitive="false"/>
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
    <p>填空：植物将光能转化为化学能的过程称为<textEntryInteraction responseIdentifier="RESPONSE" expectedLength="15"/>。</p>
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
    title: '太阳系 - 标记行星',
    description: '一个图形间隙匹配互动，用于标记内行星',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-solar-system.zh-CN"
  title="太阳系 - 标记行星"
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
    <p>我们太阳系的内行星是离太阳最近的四颗岩石行星：水星、金星、地球和火星。</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>标记太阳系中的四颗内行星</prompt>
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
          <text x="30" y="270" font-size="12" fill="#FDB813" text-anchor="middle" font-family="Arial, sans-serif">太阳</text>
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
          <text x="400" y="30" font-size="20" font-weight="bold" fill="white" text-anchor="middle">太阳系的内行星</text>
        </svg>
      </object>
      <gapText identifier="MERCURY" matchMax="1">水星</gapText>
      <gapText identifier="VENUS" matchMax="1">金星</gapText>
      <gapText identifier="EARTH" matchMax="1">地球</gapText>
      <gapText identifier="MARS" matchMax="1">火星</gapText>
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
    title: '热点交互 - 太阳系',
    description: '识别行星中的地球的热点问题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hotspot-interaction.zh-CN"
  title="热点交互 - 太阳系"
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
    <p><strong>天文学问题：</strong> 我们太阳系中哪颗行星因其丰富的水资源而被称为"蓝色星球"？</p>
    <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>点击表面大部分被液态水覆盖的行星</prompt>
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
          <text x="150" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">水星</text>
          <circle cx="280" cy="200" r="28" fill="url(#venusGrad)"/>
          <text x="280" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">金星</text>
          <circle cx="430" cy="200" r="30" fill="url(#earthGrad)"/>
          <path d="M 425,185 Q 435,180 445,185 L 450,195 Q 445,200 435,198 Z" fill="#2d5016" opacity="0.7"/>
          <path d="M 410,200 Q 415,195 425,200 L 425,210 Q 420,212 410,208 Z" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="435" cy="210" rx="8" ry="5" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="445" cy="195" rx="6" ry="3" fill="white" opacity="0.5"/>
          <ellipse cx="415" cy="205" rx="5" ry="2.5" fill="white" opacity="0.5"/>
          <text x="430" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">地球</text>
          <circle cx="580" cy="200" r="24" fill="url(#marsGrad)"/>
          <circle cx="575" cy="185" r="5" fill="white" opacity="0.6"/>
          <text x="580" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">火星</text>
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
    title: '绘图交互',
    description: '在画布上创建线条的绘图问题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="drawing-interaction.zh-CN"
  title="绘图交互"
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
    <p><strong>绘图：</strong> 在画布上画一条线。</p>
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
    title: '可点击文本交互 - 多选',
    description: '区分事实与观点的可点击文本问题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-multiple.zh-CN"
  title="可点击文本交互 - 多选"
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
    <p><strong>阅读理解：</strong> 选择所有事实陈述（非观点）。</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="3">
      <prompt>选择事实陈述：</prompt>
      <p><hottext identifier="H1">夏天是最好的季节</hottext></p>
      <p><hottext identifier="H2">水在海平面上于100°C沸腾</hottext></p>
      <p><hottext identifier="H3">古典音乐比流行音乐更复杂</hottext></p>
      <p><hottext identifier="H4">地球绕太阳运行</hottext></p>
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
    title: '图形顺序交互',
    description: '关于地质层次的图形顺序问题',
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="graphic-order.zh-CN"
  title="图形顺序交互">
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
    <p><strong>地质学：</strong> 从下到上排列地质层次。</p>
    <graphicOrderInteraction responseIdentifier="RESPONSE">
      <prompt>拖动以正确重新排序层次：</prompt>
      <object type="image/png" data="/sample-geolayers.png" width="600" height="350">
        地质层横截面图
      </object>
      <hotspotChoice identifier="TOPSOIL" shape="rect" coords="0,0,100,50">表土</hotspotChoice>
      <hotspotChoice identifier="SEDIMENTARY" shape="rect" coords="0,0,100,50">沉积岩</hotspotChoice>
      <hotspotChoice identifier="BEDROCK" shape="rect" coords="0,0,100,50">基岩</hotspotChoice>
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
