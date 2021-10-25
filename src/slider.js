import findIndex from 'lodash/findIndex';
import {sliderHorizontal} from 'd3-simple-slider';
import set from 'lodash/set';
import get from 'lodash/get';

// Import math modules in a way that minimizes bundle size
import {create, roundDependencies, piDependencies} from '../mathjs/lib/esm/index.js';
const {round, pi} = create({roundDependencies, piDependencies});

function slider(click, parameter, dy, histories, update) {
	let parent = click.target.__data__;
	const path = [];
	while (parent.parent) {
		const childIndex = findIndex(parent.parent.data.children, child =>
			(child.basis === parent.data.basis & child.event === parent.data.event));
		path.unshift('children', childIndex);
		parent = parent.parent;
	}

	path.push('children');

	const parameterInit = get(histories, path)[0][parameter];
	return sliderHorizontal().min(0).max(2 * pi).step(0.01).width(dy * 1.75).default(parameterInit)
		.on('end', value => {
			histories = set(histories, path, get(histories, path).map(child => {
				child[parameter] = round(value, 2);
				return child;
			}));

			update(histories);
		});
}

export {slider};
