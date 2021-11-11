import findIndex from 'lodash/findIndex';
import set from 'lodash/set';
import get from 'lodash/get';
import initial from 'lodash/initial';
import last from 'lodash/last';
import pullAt from 'lodash/pullAt';

function counterClick(click, histories) {
	let {parent} = click.target.__data__;
	const {event} = click.target.__data__.data;
	const path = ['children', findIndex(parent.children, child =>
		(child.data.basis === parent.basis && child.data.event === event))];
	while (parent.parent) {
		const childIndex = findIndex(parent.parent.data.children, child =>
			(child.basis === parent.data.basis & child.event === parent.data.event));
		path.unshift('children', childIndex);
		parent = parent.parent;
	}

	path.push('ignored');
	histories = set(histories, path, true);
	return histories;
}

function counterBlockClick(click, histories) {
	let {parent} = click.target.__data__;
	// Ignore case of only child
	if (parent.children.length < 2) {
		return histories;
	}

	const {event} = click.target.__data__.data;
	const path = ['children', findIndex(parent.children, child =>
		(child.data.basis === parent.basis && child.data.event === event))];
	while (parent.parent) {
		const childIndex = findIndex(parent.parent.data.children, child =>
			(child.basis === parent.data.basis & child.event === parent.data.event));
		path.unshift('children', childIndex);
		parent = parent.parent;
	}

	const children = get(histories, initial(path));
	children[(last(path) === 0) ? 1 : 0].event = 'identity';
	pullAt(children, last(path));
	histories = set(histories, initial(path), children);
	return histories;
}

export {counterClick, counterBlockClick};
