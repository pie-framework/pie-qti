# Manual Test Script for Correct Answer Display

This script helps you systematically test correct answer display across all interaction types.

## Setup

1. Ensure dev server is running: `bun run dev`
2. Open browser to: `http://localhost:5173`

## Test Procedure

For each interaction type below:

1. Navigate to the item demo page
2. **Change Role to "Scorer"** (this is critical!)
3. Verify correct answers are displayed
4. Take a screenshot for documentation
5. Check off the item in the checklist

## Test Items

### ✅ Choice Interaction
- **URL**: `http://localhost:5173/item-demo/simple-choice`
- **Correct Answer**: ChoiceA (7)
- **Check**: Green highlight, border, and "Correct" badge on "7"

### ✅ Match Interaction
- **URL**: `http://localhost:5173/item-demo/match-interaction`
- **Correct Answers**: Pairs like "A X", "B Y"
- **Check**: Green highlighting on correct source-target pairs

### ✅ Order Interaction
- **URL**: `http://localhost:5173/item-demo/order-interaction`
- **Correct Answer**: Specific order of items
- **Check**: Green highlighting on items in correct positions

### ✅ Associate Interaction
- **URL**: `http://localhost:5173/item-demo/associate-interaction`
- **Correct Answers**: Specific associations between choices
- **Check**: Green highlighting on correct associations

### ✅ Hottext Interaction
- **URL**: `http://localhost:5173/item-demo/hottext-single`
- **Correct Answers**: Specific text selections
- **Check**: Green border/background on correct selectable text

### ✅ Hotspot Interaction
- **URL**: `http://localhost:5173/item-demo/hotspot`
- **Correct Answers**: Specific hotspot regions
- **Check**: Green fill/stroke on correct hotspot areas

### ✅ Slider Interaction
- **URL**: `http://localhost:5173/item-demo/slider`
- **Correct Answer**: Specific numeric value
- **Check**: "Correct: [value]" badge displayed

### ✅ Gap Match Interaction
- **URL**: `http://localhost:5173/item-demo/gap-match`
- **Correct Answers**: Specific words for each gap
- **Check**: Green highlighting and correct words shown in gaps

### ✅ Text Entry Interaction
- **URL**: `http://localhost:5173/item-demo/text-entry`
- **Correct Answer**: Specific text value
- **Check**: Green border/background on input, "Correct: [answer]" badge

### ✅ Inline Choice Interaction
- **URL**: `http://localhost:5173/item-demo/inline-choice`
- **Correct Answer**: Specific choice identifier
- **Check**: Green border/background on dropdown, checkmark on correct option, badge showing correct choice

### ✅ Extended Text Interaction
- **URL**: `http://localhost:5173/item-demo/extended-text`
- **Correct Answer**: Model answer text (if provided)
- **Check**: Green-bordered box below editor showing correct answer

## Quick Test Command

You can use this browser console script to quickly switch roles:

```javascript
// Find the role select element and change to scorer
const roleSelect = document.querySelector('select[id*="role"], select[aria-label*="Role"]');
if (roleSelect) {
  roleSelect.value = 'scorer';
  roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
}
```

## Expected Visual Indicators

All correct answers should show:
- ✅ Green background (light tint)
- ✅ Green border
- ✅ "Correct" badge (where applicable)
- ✅ Consistent styling across all interactions

## Reporting Issues

If any interaction type doesn't show correct answers:
1. Note which interaction type
2. Check browser console for errors
3. Verify role is set to "Scorer"
4. Check that the item has a `correctResponse` in its XML
5. Document the issue with screenshot
