import findIndex from 'lodash/findIndex';
import set from 'lodash/set';
import get from 'lodash/get';

function magnetClick(click, histories) {
	// Ignore non-left clicks
	if (click.which !== 1) {
		return histories;
	}

	let parent = click.target.__data__;
	// Get path to children that click should modify
	const path = ['children', findIndex(parent.children, child =>
		(child.data.basis === parent.basis))];
	while (parent.parent) {
		const childIndex = findIndex(parent.parent.data.children, child =>
			(child.basis === parent.data.basis & child.event === parent.data.event));
		path.unshift('children', childIndex);
		parent = parent.parent;
	}

	path.push('children');

	// Limit amount of measurements
	if (path.length > 10) {
		return histories;
	}

	// Counter -> analyzer
	if ((get(histories, path).length === 0)) {
		histories = set(histories, path, [
			{
				basis: 'z',
				event: 'spinUp',
				children: [],
			},
			{
				basis: 'z',
				event: 'spinDown',
				children: [],
			},
		]);
		return histories;
	}

	// Magnet -> analyzer
	if (get(histories, path)[0].event === 'magnet') {
		histories = set(histories, path, []);
		return histories;
	}

	// Analyzer -> magnet
	histories = set(histories, path, [
		{
			basis: 'z',
			event: 'magnet',
			magnitude: 1,
			children: [],
		},
	]);

	return histories;
}

export {magnetClick};
