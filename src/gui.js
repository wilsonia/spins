import {computeProbabilities} from './physics.js';
import * as d3 from 'd3';
import isPlainObject from 'lodash/isPlainObject';
import {round} from 'mathjs';
import katex from 'katex';

const histories = {
	'z,up': {
		'n,up,1.57,1.57': {},
		'n,down,1.57,1.57': {},
	},
	'z,down': {
		'x,up': {
		},
		'x,down':
		{
			'y,up':
			{

			},
			'y,down':
			{

			},
		},
	},
};

const margin = {top: 100, right: 120, bottom: 200, left: 100};
const width = d3.width || 500;
const height = d3.height || 650;
const root = d3.hierarchy(computeProbabilities(histories), branch => Object.values(branch));
const dx = width / 10;
const dy = height / 10;
const nodeLength = 2 * dx;
const tree = d3.tree().size([width, height]).nodeSize([1.2 * nodeLength, 2.5 * nodeLength]);
const diagonal = d3
	.linkHorizontal()
	.x(d => d.y)
	.y(d => d.x);

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
		d.basis = round(d.data, 2);
	}
});

tree(root);

const svg = d3
	.create('svg')
	.attr('viewBox', [-margin.left, -margin.top, width * 2, height + margin.bottom])
	.style('font', '10px sans-serif')
	.style('user-select', 'none');

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

update(root);

document.querySelector('#app').appendChild(svg.node());

function update(source) {
	const duration = d3.event && d3.event.altKey ? 2500 : 250;
	const nodes = root.descendants().reverse();
	const links = root.links();

	// Compute the new tree layout.

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

	const transition = svg
		.transition()
		.duration(duration)
		.attr('viewBox', [-margin.left, left.x - margin.top, width * 2, height + margin.bottom])
		.tween(
			'resize',
			window.ResizeObserver ? null : () => () => svg.dispatch('toggle'),
		);

	// Update the nodes…
	const node = gNode.selectAll('g').data(nodes, d => d.id);

	const nodeEnter = node
		.enter()
		.append('g')
		.attr('transform', () => `translate(${source.y0},${source.x0})`)
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0)
		.on('click', (event, d) => {
			update(d);
		});

	nodeEnter
		.append('rect')
		.attr('width', nodeLength)
		.attr('height', nodeLength)
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey');

	nodeEnter
		.append('foreignObject')
		.attr('width', 480)
		.attr('height', 500)
		.attr('y', 0.1 * dx)
		.append('xhtml:body')
		.html(d => katex.renderToString(`\\LARGE{\\hat{${d.basis}}}`));

	nodeEnter
		.append('foreignObject')
		.attr('width', 480)
		.attr('height', 500)
		.attr('y', 0.4 * dx)
		.append('xhtml:body')
		.html(d => katex.renderToString(d.theta ? `\\theta = ${d.theta}` : ''));

	nodeEnter
		.append('foreignObject')
		.attr('width', 480)
		.attr('height', 500)
		.attr('y', 0.6 * dx)
		.append('xhtml:body')
		.html(d => katex.renderToString(d.theta ? `\\phi = ${d.phi}` : ''));

	// Transition nodes to their new position.
	node
		.merge(nodeEnter)
		.transition(transition)
		.attr('transform', d => `translate(${d.y - (nodeLength / 2)},${d.x - (nodeLength / 2)})`)
		.attr('fill-opacity', 1)
		.attr('stroke-opacity', 1);

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
