// Shared color utilities for sender/mention coloring

/**
 * Deterministically map a key (userId or name) to a text color class.
 * This must remain in sync across ChatView, Mention badges, and Markdown mentions.
 */
export function getSenderColorClass(key: string): string {
	if (!key) return 'text-foreground';
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		hash = ((hash << 5) - hash) + key.charCodeAt(i);
		hash |= 0; // Convert to 32bit int
	}
	const colors = [
		'text-blue-600 dark:text-blue-400',
		'text-green-600 dark:text-green-400',
		'text-purple-600 dark:text-purple-400',
		'text-orange-600 dark:text-orange-400',
		'text-pink-600 dark:text-pink-400',
		'text-indigo-600 dark:text-indigo-400',
		'text-teal-600 dark:text-teal-400',
		'text-red-600 dark:text-red-400',
	];
	return colors[Math.abs(hash) % colors.length];
}

/**
 * Return coordinated text and background classes for mention chips/badges.
 * The text color matches getSenderColorClass; background is a soft tint that
 * works in both light and dark themes.
 */
export function getSenderToneClasses(key: string): { text: string; bg: string } {
	if (!key) return { text: 'text-foreground', bg: 'bg-muted' };
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		hash = ((hash << 5) - hash) + key.charCodeAt(i);
		hash |= 0;
	}
	const tones = [
		{ text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
		{ text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' },
		{ text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' },
		{ text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' },
		{ text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/30' },
		{ text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
		{ text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30' },
		{ text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' },
	];
	return tones[Math.abs(hash) % tones.length];
}


