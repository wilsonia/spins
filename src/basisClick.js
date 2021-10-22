import findIndex from 'lodash/findIndex';
import set from 'lodash/set';
import get from 'lodash/get';

function basisClick(click, histories) {
	let parent = click.target.__data__;
	const path = [];
	while (parent.parent) {
		const childIndex = findIndex(parent.parent.data.children, child =>
			(child.basis === parent.data.basis & child.event === parent.data.event));
		path.unshift('children', childIndex);
		parent = parent.parent;
	}

	path.push('children');

	histories = set(histories, path, get(histories, path).map(child => {
		child.basis = {
			z: 'x',
			x: 'y',
			y: 'n',
			n: 'z',
		}[child.basis];
		child.theta = undefined;
		child.phi = undefined;
		if ((child.basis === 'n') & (child.theta === undefined)) {
			child.theta = 0;
			child.phi = 0;
		}

		return child;
	}));
	return histories;
}

export {basisClick};
