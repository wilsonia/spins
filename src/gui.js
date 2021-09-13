import {computeProbabilities} from './physics.js';
import * as d3 from 'd3';
import isPlainObject from 'lodash/isPlainObject';
import set from 'lodash/set';
import {round} from 'mathjs';
import katex from 'katex';

let histories = {
	'z,up': {
		'x,up': {
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
	.x(d => d.y - (dy / 4))
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
			const [basis, spin, theta, phi] = Object.keys(d.data)[0].split(',');
			d.basis = basis;
			d.spin = spin;
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
function draw(source) {
	svg.selectAll('*').remove();
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
	const duration = d3.event && d3.event.altKey ? 2500 : 250;
	const nodes = root.descendants().reverse();
	const links = root.links();

	// Set svg size
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
	svg
		.transition()
		.duration(duration)
		.attr('viewBox', [-margin.left, left.x - margin.top, width, height])
		.tween(
			'resize',
			window.ResizeObserver ? null : () => () => svg.dispatch('toggle'),
		);

	// Draw analyzers
	const analyzers = gNode.selectAll('g').data(nodes.filter(node => isPlainObject(node.data)), d => d.id);
	const analyzerEnter = analyzers
		.enter()
		.append('g')
		.attr('transform', `translate(${source.y0},${source.x0})`)
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0);

	// Draw outline
	analyzerEnter
		.append('rect')
		.attr('width', nodeLength)
		.attr('x', -1 * (nodeLength / 2))
		.attr('y', -1 * (nodeLength / 2))
		.attr('height', nodeLength)
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey');

	// Draw spin-up port
	analyzerEnter
		.append('foreignObject')
		.attr('x', nodeLength / 5)
		.attr('y', -1 * (nodeLength / 2))
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.style('pointer-events', 'hidden')
		.append('xhtml:body')
		.html(katex.renderToString('\\Huge{\\pmb{+}}'));

	analyzerEnter
		.append('rect')
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.attr('x', nodeLength / 4)
		.attr('y', -1 * (nodeLength / 2))
		.attr('fill', 'transparent')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey')
		.style('pointer-events', 'visible')
		.on('click', click => {
			const path = [`${click.target.__data__.basis},up`];
			let {parent} = click.target.__data__;
			while (parent) {
				path.unshift(`${parent.basis},${parent.spin}`);
				parent = parent.parent;
			}

			histories = set(histories, path, {'z,up': {}, 'z,down': {}});
			root = getRoot(histories);
			console.log(root);
			draw(root);
		});

	// Draw spin-down port
	analyzerEnter
		.append('rect')
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.attr('x', nodeLength / 4)
		.attr('y', 0)
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey');

	analyzerEnter
		.append('foreignObject')
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.style('pointer-events', 'hidden')
		.attr('x', nodeLength / 5)
		.attr('y', 0)
		.append('xhtml:body')
		.html(katex.renderToString('\\Huge{\\pmb{-}}'));

	// Label analyzers
	analyzerEnter
		.append('foreignObject')
		.attr('x', -0.25 * nodeLength)
		.attr('y', -0.4 * nodeLength)
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.style('pointer-events', 'hidden')
		.append('xhtml:body')
		.html(d => katex.renderToString(`\\Huge{\\hat{${d.basis}}}`));

	analyzerEnter
		.append('foreignObject')
		.attr('x', -0.5 * nodeLength)
		.attr('y', -0.05 * nodeLength)
		.attr('width', nodeLength)
		.attr('height', nodeLength / 4)
		.style('pointer-events', 'hidden')
		.append('xhtml:body')
		.html(d => katex.renderToString(d.theta ? `\\Large{\\theta = ${d.theta}}` : ''));

	analyzerEnter
		.append('foreignObject')
		.attr('x', -0.5 * nodeLength)
		.attr('y', 0.15 * nodeLength)
		.attr('width', nodeLength)
		.attr('height', nodeLength / 4)
		.style('pointer-events', 'hidden')
		.append('xhtml:body')
		.html(d => katex.renderToString(d.phi ? `\\Large{\\phi = ${d.phi}}` : ''));

	analyzers
		.merge(analyzerEnter)
		.attr('transform', d => `translate(${d.y},${d.x})`)
		.attr('fill-opacity', 1)
		.attr('stroke-opacity', 1);

	// Draw counters
	const counters = gNode.selectAll('g').data(nodes.filter(node => !isPlainObject(node.data)), d => d.id);
	const counterEnter = counters
		.enter()
		.append('g')
		.attr('transform', `translate(${source.y0},${source.x0})`)
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0);

	counterEnter
		.append('foreignObject')
		.attr('width', nodeLength / 2)
		.attr('height', nodeLength / 4)
		.style('pointer-events', 'hidden')
		.attr('x', -0.35 * nodeLength)
		.attr('y', -0.175 * nodeLength)
		.append('xhtml:body')
		.html(d => katex.renderToString(`\\LARGE{${d.probability}}`));

	counters
		.merge(counterEnter)
		.attr('transform', d => `translate(${d.y},${d.x})`)
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

	link.merge(linkEnter).attr('d', diagonal);
	link
		.exit()
		.remove()
		.attr('d', () => {
			const o = {x: source.x, y: source.y};
			return diagonal({source: o, target: o});
		});
}

let root = getRoot(histories);
draw(root);
