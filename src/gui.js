import {computeProbabilities} from './physics.js';
import * as d3 from 'd3';
import isPlainObject from 'lodash/isPlainObject';
import {round} from 'mathjs';

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

const margin = {top: 100, right: 120, bottom: 100, left: 100};
const width = d3.width || 960;
const root = d3.hierarchy(computeProbabilities(histories), branch => Object.values(branch));
const dx = width / 12;
const dy = width / 5;
const tree = d3.tree().nodeSize([dx, dy]);
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
		d.basis = `S${basis}`;
		d.theta = (basis === 'n') ? `theta = ${round(theta, 2)}` : '';
		d.phi = (basis === 'n') ? `phi = ${round(phi, 2)}` : '';
	}

	// Label probabilities at leaves
	if (typeof d.data === 'number') {
		d.basis = round(d.data, 2);
	}
});

tree(root);

const svg = d3
	.create('svg')
	.attr('viewBox', [-margin.left, -margin.top, width, dx])
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
		.attr('width', 1.25 * dx)
		.attr('height', 0.8 * dx)
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey');

	nodeEnter
		.append('text')
		.attr('dy', '0.31em')
		.attr('x', 6)
		.attr('y', 0.2 * dx)
		.attr('text-anchor', 'start')
		.text(d => d.basis)
		.clone(true)
		.lower()
		.attr('stroke-linejoin', 'round')
		.attr('stroke-width', 3)
		.attr('stroke', 'white');

	nodeEnter
		.append('text')
		.attr('dy', '0.31em')
		.attr('x', 6)
		.attr('y', 0.4 * dx)
		.attr('text-anchor', 'start')
		.text(d => d.theta)
		.clone(true)
		.lower()
		.attr('stroke-linejoin', 'round')
		.attr('stroke-width', 3)
		.attr('stroke', 'white');

	nodeEnter
		.append('text')
		.attr('dy', '0.31em')
		.attr('x', 6)
		.attr('y', 0.6 * dx)
		.attr('text-anchor', 'start')
		.text(d => d.phi)
		.clone(true)
		.lower()
		.attr('stroke-linejoin', 'round')
		.attr('stroke-width', 3)
		.attr('stroke', 'white');

	// Transition nodes to their new position.
	node
		.merge(nodeEnter)
		.transition(transition)
		.attr('transform', d => `translate(${d.y - (1.25 * dx / 2)},${d.x - (0.8 * dx / 2)})`)
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
