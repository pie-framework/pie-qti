/**
 * Feedback and template visibility
 *
 * A feedback or template element names a variable and an `identifier`. The identifier matches a
 * single value by equality and a container by membership; NULL matches nothing. `showHide="show"`
 * (the default) shows the element on a match, `showHide="hide"` shows it unless there is one.
 * Item feedback, modal feedback, test feedback and template content all use this rule.
 */

/** Whether `identifier` matches `value`, the plain value of the variable the element names. */
export function matchesIdentifier(value: unknown, identifier: string): boolean {
	if (Array.isArray(value)) return value.some((item) => item !== null && String(item) === identifier);
	if (value === null || value === undefined || value === '') return false;
	return String(value) === identifier;
}

/** Whether an element with this `identifier` and `showHide` is shown for `value`. */
export function isShownByIdentifier(value: unknown, identifier: string, showHide?: string | null): boolean {
	const matched = matchesIdentifier(value, identifier);
	return showHide?.trim().toLowerCase() === 'hide' ? !matched : matched;
}
