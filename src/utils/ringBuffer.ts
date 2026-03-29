interface Timestamped {
	timestamp: number;
}

export function appendAndTrimByTime<T extends Timestamped>(
	items: T[],
	nextItem: T,
	maxItems: number,
	windowMs: number,
): T[] {
	const cutoff = nextItem.timestamp - windowMs;
	const nextItems = [...items, nextItem].filter(
		(item) => item.timestamp >= cutoff,
	);

	if (nextItems.length <= maxItems) {
		return nextItems;
	}

	return nextItems.slice(nextItems.length - maxItems);
}
