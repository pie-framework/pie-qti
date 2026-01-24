import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  try {
    console.log('1. Navigating to item demo page...');
    await page.goto('http://localhost:5200/item-demo');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/01-item-demo-loaded.png', fullPage: true });
    console.log('   ✓ Screenshot saved: 01-item-demo-loaded.png');

    console.log('\n2. Selecting "Simple Multiple Choice" item...');
    // Click on the "Simple Multiple Choice" dropdown option
    const sampleSelector = await page.locator('select').first();
    await sampleSelector.selectOption({ label: 'Simple Multiple Choice' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/02-simple-multiple-choice-loaded.png', fullPage: true });
    console.log('   ✓ Screenshot saved: 02-simple-multiple-choice-loaded.png');

    console.log('\n3. Checking if question content is rendered...');
    const questionText = await page.textContent('body');
    console.log('   Question visible:', questionText.includes('cookies') || questionText.includes('frog'));

    console.log('\n4. Looking for radio buttons...');
    const radioButtons = await page.locator('input[type="radio"]').count();
    console.log(`   Found ${radioButtons} radio buttons`);

    if (radioButtons > 0) {
      console.log('\n5. Selecting the first answer choice...');
      const firstRadio = page.locator('input[type="radio"]').first();
      await firstRadio.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/03-answer-selected.png', fullPage: true });
      console.log('   ✓ Screenshot saved: 03-answer-selected.png');

      console.log('\n6. Looking for Submit/Check button...');
      const submitButton = page.locator('button:has-text("Submit"), button:has-text("Check"), button:has-text("submit"), button:has-text("check")').first();
      const submitVisible = await submitButton.count() > 0;

      if (submitVisible) {
        console.log('   Clicking submit button...');
        await submitButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/04-after-submit.png', fullPage: true });
        console.log('   ✓ Screenshot saved: 04-after-submit.png');

        console.log('\n7. Checking for score display...');
        const bodyText = await page.textContent('body');
        const hasScore = bodyText.includes('Score') || bodyText.includes('score') ||
                        bodyText.includes('1/1') || bodyText.includes('Correct');
        console.log('   Score visible:', hasScore);

        if (hasScore) {
          console.log('   ✅ Score is displayed!');
        }
      } else {
        console.log('   ⚠️  Submit button not found');
      }
    }

    console.log('\n8. Taking final screenshot...');
    await page.screenshot({ path: '/tmp/05-final-state.png', fullPage: true });
    console.log('   ✓ Screenshot saved: 05-final-state.png');

    console.log('\n✅ Test completed successfully!');
    console.log('\nScreenshots saved in /tmp:');
    console.log('  - 01-item-demo-loaded.png');
    console.log('  - 02-simple-multiple-choice-loaded.png');
    console.log('  - 03-answer-selected.png');
    console.log('  - 04-after-submit.png');
    console.log('  - 05-final-state.png');

  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ path: '/tmp/error-state.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

main();
