import {computeProbabilities} from './physics.js';
import * as d3 from 'd3';
import isPlainObject from 'lodash/isPlainObject';
import {round} from 'mathjs';
import katex from 'katex';

let histories = {
	'z,up': {
		'x,up': {
			'z,up': {

			},
			'z,down': {

			},
		},
		'x,down': {},
	},
	'z,down': {
	},
};

const nodeLength = 120;
const margin = {top: nodeLength, right: nodeLength, bottom: nodeLength, left: nodeLength};
const width = d3.width || 960;
const dx = 65;
const dy = width / 6;
const diagonal = d3
	.linkHorizontal()
	.x(d => d.y)
	.y(d => d.x);
const tree = d3.tree().nodeSize([dx + (nodeLength / 2), dy + (nodeLength / 2)]);

const svg = d3
	.create('svg')
	.attr('viewBox', [-margin.left, -margin.top, width, dx])
	.style('font', '10px sans-serif')
	.style('user-select', 'none');
document.querySelector('#app').appendChild(svg.node());

// Configures a d3 hierarchy for a given set of histories
function getRoot(histories) {
	const root = d3.hierarchy(computeProbabilities(histories), branch => Object.values(branch));
	root.x0 = dy / 2;
	root.y0 = 0;
	root.descendants().forEach((d, i) => {
		d.id = i;
		// Label analyzers
		if (isPlainObject(d.data)) {
			const [basis, , theta, phi] = Object.keys(d.data)[0].split(',');
			d.basis = basis;
			d.theta = (basis === 'n') ? round(theta, 2) : '';
			d.phi = (basis === 'n') ? round(phi, 2) : '';
		}

		// Label probabilities at leaves
		if (typeof d.data === 'number') {
			d.probability = round(d.data, 2);
		}
	});

	tree(root);
	return root;
}

// Binds d3 hierarchy to svg nodes and links
function update(source) {
	const duration = d3.event && d3.event.altKey ? 2500 : 250;
	const nodes = root.descendants().reverse();
	const links = root.links();

	let left = root;
	let right = root;
	root.eachBefore(node => {
		if (node.x < left.x) {
			left = node;
		}

		if (node.x > right.x) {
			right = node;
		}
	});

	const height = right.x - left.x + margin.top + margin.bottom;

	const transition = svg
		.transition()
		.duration(duration)
		.attr('viewBox', [-margin.left, left.x - margin.top, width, height])
		.tween(
			'resize',
			window.ResizeObserver ? null : () => () => svg.dispatch('toggle'),
		);

	// Update the nodes…
	const gLink = svg
		.append('g')
		.attr('fill', 'none')
		.attr('stroke', '#555')
		.attr('stroke-opacity', 0.4)
		.attr('stroke-width', 1.5);
	const gNode = svg
		.append('g')
		.attr('cursor', 'pointer')
		.attr('pointer-events', 'all');
	const node = gNode.selectAll('g').data(nodes, d => d.id);

	// Enter any new nodes at the parent's previous position.
	const nodeEnter = node
		.enter()
		.append('g')
		.attr('transform', `translate(${source.y0},${source.x0})`)
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0);

	nodeEnter
		.append('rect')
		.attr('width', nodeLength)
		.attr('x', -1 * (nodeLength / 2))
		.attr('y', -1 * (nodeLength / 2))
		.attr('height', nodeLength)
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey')
		.attr('visibility', d => d.basis ? 'visible' : 'hidden');

	nodeEnter
		.append('rect')
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.attr('x', nodeLength / 4)
		.attr('y', -1 * (nodeLength / 2))
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey')
		.attr('visibility', d => d.basis ? 'visible' : 'hidden') // Fix this
		.on('click', () => {
			console.log('clicked');
			// Testing update behavior
			histories = {
				'z,up': {
					'x,up': {},
					'x,down': {},
				},
				'z,down': {
				},
			};
			root = getRoot(histories);
			update(root);
		});

	nodeEnter
		.append('rect')
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.attr('x', nodeLength / 4)
		.attr('y', 0)
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey')
		.attr('visibility', d => d.basis ? 'visible' : 'hidden');

	nodeEnter
		.append('foreignObject')
		.attr('width', nodeLength)
		.attr('height', nodeLength)
		.attr('x', 0)
		.attr('y', -0.15 * nodeLength)
		.append('xhtml:body')
		.html(d => katex.renderToString(d.probability ? `\\LARGE{${d.probability}}` : ''));

	nodeEnter
		.append('foreignObject')
		.attr('width', nodeLength)
		.attr('height', nodeLength)
		.attr('x', -0.5 * nodeLength)
		.attr('y', -0.4 * nodeLength)
		.append('xhtml:body')
		.html(d => katex.renderToString(d.basis ? `\\Huge{\\hat{${d.basis}}}` : ''));

	nodeEnter
		.append('foreignObject')
		.attr('width', nodeLength)
		.attr('height', nodeLength)
		.attr('x', -0.5 * nodeLength)
		.attr('y', -0.05 * nodeLength)
		.append('xhtml:body')
		.html(d => katex.renderToString(d.theta ? `\\Large{\\theta = ${d.theta}}` : ''));

	nodeEnter
		.append('foreignObject')
		.attr('width', nodeLength)
		.attr('height', nodeLength)
		.attr('x', -0.5 * nodeLength)
		.attr('y', 0.15 * nodeLength)
		.append('xhtml:body')
		.html(d => katex.renderToString(d.theta ? `\\Large{\\phi = ${d.phi}}` : ''));

	// Transition nodes to their new position.
	node
		.merge(nodeEnter)
		.transition(transition)
		.attr('transform', d => `translate(${d.y},${d.x})`)
		.attr('fill-opacity', 1)
		.attr('stroke-opacity', 1);

	// Transition exiting nodes to the parent's new position.
	node
		.exit()
		.transition(transition)
		.remove()
		.attr('transform', `translate(${source.y},${source.x})`)
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0);

	// Update the links…
	const link = gLink.selectAll('path').data(links, d => d.target.id);

	// Enter any new links at the parent's previous position.
	const linkEnter = link
		.enter()
		.append('path')
		.attr('d', () => {
			const o = {x: source.x0, y: source.y0};
			return diagonal({source: o, target: o});
		});

	// Transition links to their new position.
	link.merge(linkEnter).transition(transition).attr('d', diagonal);

	// Transition exiting nodes to the parent's new position.
	link
		.exit()
		.transition(transition)
		.remove()
		.attr('d', () => {
			const o = {x: source.x, y: source.y};
			return diagonal({source: o, target: o});
		});

	// Stash the old positions for transition.
	root.eachBefore(d => {
		d.x0 = d.x;
		d.y0 = d.y;
	});
}

let root = getRoot(histories);
update(root);
