import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });

  const page = await context.newPage();

  try {
    console.log('1. Navigating to item demo page...');
    await page.goto('http://localhost:5200/item-demo');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/step1-loaded.png', fullPage: true });
    console.log('   ✓ Screenshot: step1-loaded.png');

    console.log('\n2. Checking question content...');
    const questionText = await page.textContent('body');
    const hasQuestion = questionText.includes('Maya') && questionText.includes('cookies');
    console.log(`   ✓ Question rendered: ${hasQuestion ? 'YES' : 'NO'}`);

    console.log('\n3. Counting radio buttons...');
    const radioCount = await page.locator('input[type="radio"]').count();
    console.log(`   ✓ Found ${radioCount} radio buttons`);

    console.log('\n4. Selecting the correct answer (7)...');
    // The correct answer is 7 (12 - 5 = 7)
    // Find the radio button associated with "7"
    const correctRadio = page.locator('input[type="radio"]').first(); // "7" is the first option
    await correctRadio.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/step2-answer-selected.png', fullPage: true });
    console.log('   ✓ Screenshot: step2-answer-selected.png');

    console.log('\n5. Looking for Submit button...');
    const submitButton = page.locator('button').filter({ hasText: /Submit Answer|Submit/i });
    const submitCount = await submitButton.count();
    console.log(`   ✓ Found ${submitCount} submit button(s)`);

    if (submitCount > 0) {
      console.log('\n6. Clicking Submit button...');
      await submitButton.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/step3-submitted.png', fullPage: true });
      console.log('   ✓ Screenshot: step3-submitted.png');

      console.log('\n7. Checking for score...');
      const pageContent = await page.textContent('body');

      // Look for various score indicators
      const hasScoreOf1 = pageContent.includes('1 / 1') ||
                          pageContent.includes('1/1') ||
                          pageContent.includes('Score: 1') ||
                          pageContent.includes('score: 1');
      const hasCorrect = pageContent.includes('Correct') || pageContent.includes('correct');
      const hasMaxScore = pageContent.includes('Max Score: 1') || pageContent.includes('max score: 1');

      console.log(`   Score 1/1 visible: ${hasScoreOf1 ? 'YES ✅' : 'NO'}`);
      console.log(`   "Correct" text visible: ${hasCorrect ? 'YES ✅' : 'NO'}`);
      console.log(`   Max score visible: ${hasMaxScore ? 'YES ✅' : 'NO'}`);

      // Take a final screenshot showing the score
      await page.screenshot({ path: '/tmp/step4-final-with-score.png', fullPage: true });
      console.log('\n   ✓ Screenshot: step4-final-with-score.png');

      if (hasScoreOf1 || hasCorrect) {
        console.log('\n✅ SUCCESS: Score of 1 was achieved for the correct answer!');
      } else {
        console.log('\n⚠️  Could not confirm score of 1 in the page content');
      }
    }

    console.log('\n📸 All screenshots saved to /tmp/');
    console.log('   - step1-loaded.png');
    console.log('   - step2-answer-selected.png');
    console.log('   - step3-submitted.png');
    console.log('   - step4-final-with-score.png');

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    await page.screenshot({ path: '/tmp/error-state.png', fullPage: true });
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
}

main();
