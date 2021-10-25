import findIndex from 'lodash/findIndex';
import set from 'lodash/set';
import get from 'lodash/get';
import initial from 'lodash/initial';

function eventClick(click, clickEvent, histories) {
	// Ignore non-left clicks
	if (click.which !== 1) {
		return histories;
	}

	let parent = click.target.__data__;
	const {basis} = parent;
	const parentEvent = parent.children[0].data.event;

	// Ignorable analyzer -> non ignorable analyzer
	if (parentEvent === 'identity') {
		// Get path to children that click should modify
		const path = ['children', findIndex(parent.children, child =>
			(child.data.basis === parent.basis))];
		while (parent.parent) {
			const childIndex = findIndex(parent.parent.data.children, child =>
				(child.basis === parent.data.basis & child.event === parent.data.event));
			path.unshift('children', childIndex);
			parent = parent.parent;
		}

		let children = get(histories, initial(path));
		// Modify children
		if (clickEvent === 'spinUp') {
			children[0].event = 'spinDown';
			children = [{
				basis,
				event: 'spinUp',
				children: [],
			}].concat(children);
		} else {
			children[0].event = 'spinUp';
			children = children.concat([{
				basis,
				event: 'spinDown',
				children: [],
			}]);
		}

		histories = set(histories, initial(path), children);
		return histories;
	}

	// For non-ignorable analyzers, cycle between analyzer/counter/magnet
	// Get path to children that click should modify
	const path = ['children', findIndex(parent.children, child =>
		(child.data.basis === parent.basis & child.data.event === clickEvent))];
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

export {eventClick};
