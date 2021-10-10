import {computeProbabilities} from './physics.js';
import * as d3 from 'd3';
import {sliderHorizontal} from 'd3-simple-slider';
import set from 'lodash/set';
import get from 'lodash/get';
import findIndex from 'lodash/findIndex';
import katex from 'katex';
import omitDeep from 'deepdash/omitDeep';

// Import math modules in a way that minimizes bundle size
import {create, roundDependencies, piDependencies} from '../mathjs/lib/esm/index.js';
const {round, pi} = create({roundDependencies, piDependencies});

// Default experimental setup
let histories = {
	children: [
		{
			basis: 'z',
			event: 'spinUp',
			children: [
				{
					basis: 'x',
					event: 'spinUp',
					children: [
						{
							basis: 'z',
							event: 'spinUp',
							children: [
							],
						},
						{
							basis: 'z',
							event: 'spinDown',
							children: [
							],
						},
					],
				},
				{
					basis: 'x',
					event: 'spinDown',
					children: [],
				},
			],
		},
		{
			basis: 'z',
			event: 'spinDown',
			children: [],
		},
	],
};

const nodeLength = 120;
const margin = {top: nodeLength, right: nodeLength, bottom: nodeLength * 1.5, left: nodeLength};
const width = 1200;
const dx = 65;
const dy = width / 8;
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
	const root = d3.hierarchy(computeProbabilities(histories));
	root.x0 = dy / 2;
	root.y0 = 0;
	root.descendants().forEach((d, i) => {
		d.id = i;
		// Label analyzers
		if (d.data.children) {
			if (d.data.children[0]) {
				d.basis = d.data.children[0].basis;
				d.theta = d.data.children[0].theta;
				d.phi = d.data.children[0].phi;
				d.magnitude = d.data.children[0].magnitude;
			}
		}

		// Label probabilities at leaves
		if (d.data.probability !== undefined) {
			d.probability = round((d.data.probability), 2);
		}
	});

	tree(root);
	return root;
}

// Draw tree
let root = getRoot(histories);
draw(root);

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
		.attr('viewBox', [-margin.left, left.x - margin.top, width, height])
		.tween(
			'resize',
			window.ResizeObserver ? null : () => () => svg.dispatch('toggle'),
		);

	const analyzers = gNode.selectAll('g').data(nodes.filter(
		node => (node.data.children[0] !== undefined)).filter(
		node => node.data.children[0].event !== 'magnet'), d => d.id);
	drawAnalyzers(analyzers, source);

	// Draw magnets
	const magnets = gNode.selectAll('g').data(nodes.filter(
		node => (node.data.children[0] !== undefined)).filter(
		node => (node.data.children[0].event === 'magnet')), d => d.id);
	drawMagnets(magnets, source);

	// Draw counters
	const counters = gNode.selectAll('g').data(nodes.filter(node => (node.data.probability !== undefined)), d => d.id);
	drawCounters(counters, source);

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

function drawAnalyzers(analyzers, source) {
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
		.style('pointer-events', 'none')
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
		.on('click', click => eventLeftClick(click, 'spinUp'))
		.on('contextmenu', click => eventRightClick(click, 'spinUp'));

	// Draw spin-down port
	analyzerEnter
		.append('foreignObject')
		.attr('x', nodeLength / 5)
		.attr('y', 0)
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(katex.renderToString('\\Huge{\\pmb{-}}'));

	analyzerEnter
		.append('rect')
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.attr('x', nodeLength / 4)
		.attr('y', 0)
		.attr('fill', 'transparent')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey')
		.style('pointer-events', 'visible')
		.on('click', click => eventLeftClick(click, 'spinDown'))
		.on('contextmenu', click => eventRightClick(click, 'spinDown'));

	// Label analyzers
	analyzerEnter
		.append('foreignObject')
		.attr('x', -0.25 * nodeLength)
		.attr('y', -0.4 * nodeLength)
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(d => katex.renderToString(`\\Huge{\\hat{${d.basis}}}`));

	analyzerEnter
		.append('rect')
		.attr('x', -0.25 * nodeLength)
		.attr('y', -0.4 * nodeLength)
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 3)
		.attr('opacity', 0)
		.style('pointer-events', 'visible')
		.on('click', click => basisClick(click));

	analyzerEnter
		.append('foreignObject')
		.attr('x', -0.5 * nodeLength)
		.attr('y', -0.05 * nodeLength)
		.attr('width', nodeLength)
		.attr('height', nodeLength / 4)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(d => katex.renderToString((d.basis === 'n') ? `\\Large{\\theta = ${d.theta}}` : ''));

	analyzerEnter
		.append('rect')
		.attr('x', -1 * nodeLength / 2)
		.attr('y', -0.05 * nodeLength)
		.attr('width', 3 * nodeLength / 4)
		.attr('height', nodeLength / 4)
		.attr('opacity', 0)
		.style('pointer-events', (d => (d.basis === 'n') ? 'visible' : 'none'))
		.on('click', click => {
			svg.selectAll('.slider').remove();
			svg.selectAll('.axis').remove();
			svg.append('foreignObject')
				.attr('class', 'axis')
				.attr('x', `${click.target.__data__.y + (1.25 * dx)}`)
				.attr('y', `${click.target.__data__.x + (0.75 * dx)}`)
				.attr('width', nodeLength / 4)
				.attr('height', nodeLength / 4)
				.style('ponter-events', 'none')
				.append('xhtml:body')
				.html(katex.renderToString('\\LARGE{\\theta}'));
			svg.append('g')
				.attr('pointer-events', 'all')
				.attr('transform', `translate(${click.target.__data__.y + dx}, ${click.target.__data__.x + (1.4 * dx)})`)
				.call(slider(click, 'theta'));
		});

	analyzerEnter
		.append('foreignObject')
		.attr('x', -0.5 * nodeLength)
		.attr('y', 0.15 * nodeLength)
		.attr('width', nodeLength)
		.attr('height', nodeLength / 4)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(d => katex.renderToString(d.basis === 'n' ? `\\Large{\\phi = ${d.phi}}` : ''));

	analyzerEnter
		.append('rect')
		.attr('x', -1 * nodeLength / 2)
		.attr('y', 0.18 * nodeLength)
		.attr('width', 3 * nodeLength / 4)
		.attr('height', nodeLength / 4)
		.attr('opacity', 0)
		.style('pointer-events', (d => (d.basis === 'n') ? 'visible' : 'none'))
		.on('click', click => {
			svg.selectAll('.slider').remove();
			svg.selectAll('.axis').remove();
			svg.append('foreignObject')
				.attr('class', 'axis')
				.attr('x', `${click.target.__data__.y + (1.25 * dx)}`)
				.attr('y', `${click.target.__data__.x + (0.75 * dx)}`)
				.attr('width', nodeLength / 4)
				.attr('height', nodeLength / 4)
				.style('ponter-events', 'none')
				.append('xhtml:body')
				.html(katex.renderToString('\\LARGE{\\phi}'));
			svg.append('g')
				.attr('transform', `translate(${click.target.__data__.y + dx}, ${click.target.__data__.x + (1.4 * dx)})`)
				.call(slider(click, 'phi'));
		});

	analyzers
		.merge(analyzerEnter)
		.attr('transform', d => `translate(${d.y},${d.x})`)
		.attr('fill-opacity', 1)
		.attr('stroke-opacity', 1);
}

function drawMagnets(magnets, source) {
	const magnetEnter = magnets
		.enter()
		.append('g')
		.attr('transform', `translate(${source.y0},${source.x0})`)
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0);

	// Draw outline
	magnetEnter
		.append('rect')
		.attr('width', nodeLength)
		.attr('x', -1 * (nodeLength / 2))
		.attr('y', -1 * (nodeLength / 2))
		.attr('height', nodeLength)
		.attr('fill', 'gainsboro')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey');

	// Draw output port
	magnetEnter
		.append('rect')
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength)
		.attr('x', nodeLength / 4)
		.attr('y', -nodeLength / 2)
		.attr('fill', 'transparent')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey')
		.style('pointer-events', 'visible')
		.on('click', click => magnetLeftClick(click))
		.on('contextmenu', click => magnetRightClick(click));

	// Label magnets
	magnetEnter
		.append('foreignObject')
		.attr('x', -0.25 * nodeLength)
		.attr('y', -0.55 * nodeLength)
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 2)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(d => katex.renderToString(`\\Huge{\\hat{${d.basis}}}`));

	magnetEnter
		.append('rect')
		.attr('x', -0.25 * nodeLength)
		.attr('y', -0.55 * nodeLength)
		.attr('width', nodeLength / 4)
		.attr('height', nodeLength / 3)
		.attr('opacity', 0)
		.style('pointer-events', 'visible')
		.on('click', click => basisClick(click));

	magnetEnter
		.append('foreignObject')
		.attr('x', -0.5 * nodeLength)
		.attr('y', -0.24 * nodeLength)
		.attr('width', nodeLength)
		.attr('height', nodeLength / 3)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(d => katex.renderToString(`\\Large{\\omega = ${d.magnitude}}`));

	magnetEnter
		.append('rect')
		.attr('x', -1 * nodeLength / 2)
		.attr('y', -0.24 * nodeLength)
		.attr('width', 3 * nodeLength / 4)
		.attr('height', nodeLength / 4)
		.attr('opacity', 0)
		.on('click', click => {
			svg.selectAll('.slider').remove();
			svg.selectAll('.axis').remove();
			svg.append('foreignObject')
				.attr('class', 'axis')
				.attr('x', `${click.target.__data__.y + (1.25 * dx)}`)
				.attr('y', `${click.target.__data__.x + (0.85 * dx)}`)
				.attr('width', nodeLength)
				.attr('height', nodeLength / 3)
				.style('ponter-events', 'none')
				.append('xhtml:body')
				.html(katex.renderToString('\\LARGE{\\omega = \\frac{e}{m_e} |\\vec{B}|}'));
			svg.append('g')
				.attr('pointer-events', 'all')
				.attr('transform', `translate(${click.target.__data__.y + dx}, ${click.target.__data__.x + (1.6 * dx)})`)
				.call(slider(click, 'magnitude'));
		});

	magnetEnter
		.append('foreignObject')
		.attr('x', -0.5 * nodeLength)
		.attr('y', -0.05 * nodeLength)
		.attr('width', nodeLength)
		.attr('height', nodeLength / 4)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(d => katex.renderToString((d.basis === 'n') ? `\\Large{\\theta = ${d.theta}}` : ''));

	magnetEnter
		.append('rect')
		.attr('x', -1 * nodeLength / 2)
		.attr('y', -0.05 * nodeLength)
		.attr('width', 3 * nodeLength / 4)
		.attr('height', nodeLength / 4)
		.attr('opacity', 0)
		.style('pointer-events', (d => (d.basis === 'n') ? 'visible' : 'none'))
		.on('click', click => {
			svg.selectAll('.slider').remove();
			svg.selectAll('.axis').remove();
			svg.append('foreignObject')
				.attr('class', 'axis')
				.attr('x', `${click.target.__data__.y + (1.25 * dx)}`)
				.attr('y', `${click.target.__data__.x + (0.75 * dx)}`)
				.attr('width', nodeLength / 4)
				.attr('height', nodeLength / 4)
				.style('ponter-events', 'none')
				.append('xhtml:body')
				.html(katex.renderToString('\\LARGE{\\theta}'));
			svg.append('g')
				.attr('pointer-events', 'all')
				.attr('transform', `translate(${click.target.__data__.y + dx}, ${click.target.__data__.x + (1.4 * dx)})`)
				.call(slider(click, 'theta'));
		});

	magnetEnter
		.append('foreignObject')
		.attr('x', -0.5 * nodeLength)
		.attr('y', 0.15 * nodeLength)
		.attr('width', nodeLength)
		.attr('height', nodeLength / 4)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(d => katex.renderToString(d.basis === 'n' ? `\\Large{\\phi = ${d.phi}}` : ''));

	magnetEnter
		.append('rect')
		.attr('x', -1 * nodeLength / 2)
		.attr('y', 0.18 * nodeLength)
		.attr('width', 3 * nodeLength / 4)
		.attr('height', nodeLength / 4)
		.attr('opacity', 0)
		.style('pointer-events', (d => (d.basis === 'n') ? 'visible' : 'none'))
		.on('click', click => {
			svg.selectAll('.slider').remove();
			svg.selectAll('.axis').remove();
			svg.append('foreignObject')
				.attr('class', 'axis')
				.attr('x', `${click.target.__data__.y + (1.25 * dx)}`)
				.attr('y', `${click.target.__data__.x + (0.75 * dx)}`)
				.attr('width', nodeLength / 4)
				.attr('height', nodeLength / 4)
				.style('ponter-events', 'none')
				.append('xhtml:body')
				.html(katex.renderToString('\\LARGE{\\phi}'));
			svg.append('g')
				.attr('transform', `translate(${click.target.__data__.y + dx}, ${click.target.__data__.x + (1.4 * dx)})`)
				.call(slider(click, 'phi'));
		});

	magnets
		.merge(magnetEnter)
		.attr('transform', d => `translate(${d.y},${d.x})`)
		.attr('fill-opacity', 1)
		.attr('stroke-opacity', 1);
}

function drawCounters(counters, source) {
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
		.style('pointer-events', 'none')
		.attr('x', -0.35 * nodeLength)
		.attr('y', -0.175 * nodeLength)
		.append('xhtml:body')
		.html(d => katex.renderToString(`\\LARGE{${d.probability}}`));

	counters
		.merge(counterEnter)
		.attr('transform', d => `translate(${d.y},${d.x})`)
		.attr('fill-opacity', 1)
		.attr('stroke-opacity', 1);
}

// Define click behavior
function basisClick(click) {
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

	root = getRoot(histories);
	draw(root);
}

function slider(click, parameter) {
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

			root = getRoot(histories);
			draw(root);
		});
}

function eventLeftClick(click, event) {
	let parent = click.target.__data__;
	const path = ['children', findIndex(parent.children, child =>
		(child.data.basis === parent.basis & child.data.event === event))];
	while (parent.parent) {
		const childIndex = findIndex(parent.parent.data.children, child =>
			(child.basis === parent.data.basis & child.event === parent.data.event));
		path.unshift('children', childIndex);
		parent = parent.parent;
	}

	path.push('children');
	console.log(path);
	histories = set(histories, path, ((get(histories, path).length === 0) & (path.length < 11))
		? [
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
		]
		: []);
	root = getRoot(histories);
	draw(root);
}

function eventRightClick(click, event) {
	click.preventDefault();
	let parent = click.target.__data__;
	const path = ['children', findIndex(parent.children, child =>
		(child.data.basis === parent.basis & child.data.event === event))];
	while (parent.parent) {
		const childIndex = findIndex(parent.parent.data.children, child =>
			(child.basis === parent.data.basis & child.event === parent.data.event));
		path.unshift('children', childIndex);
		parent = parent.parent;
	}

	path.push('children');
	histories = set(histories, path, ((get(histories, path).length === 0) & (path.length < 11))
		? [
			{
				basis: 'z',
				event: 'magnet',
				magnitude: 1,
				children: [],
			},
		]
		: []);
	root = getRoot(histories);
	draw(root);
}

function magnetLeftClick(click) {
	let parent = click.target.__data__;
	const path = ['children', findIndex(parent.children, child =>
		(child.data.basis === parent.basis))];
	while (parent.parent) {
		const childIndex = findIndex(parent.parent.data.children, child =>
			(child.basis === parent.data.basis & child.event === parent.data.event));
		path.unshift('children', childIndex);
		parent = parent.parent;
	}

	path.push('children');
	histories = set(histories, path, ((get(histories, path).length === 0) & (path.length < 11))
		? [
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
		]
		: []);
	root = getRoot(histories);
	draw(root);
}

function magnetRightClick(click) {
	click.preventDefault();
	let parent = click.target.__data__;
	const path = ['children', findIndex(parent.children, child =>
		(child.data.basis === parent.basis))];
	while (parent.parent) {
		const childIndex = findIndex(parent.parent.data.children, child =>
			(child.basis === parent.data.basis & child.event === parent.data.event));
		path.unshift('children', childIndex);
		parent = parent.parent;
	}

	path.push('children');
	histories = set(histories, path, ((get(histories, path).length === 0) & (path.length < 11))
		? [
			{
				basis: 'z',
				event: 'magnet',
				magnitude: 1,
				children: [],
			},
		]
		: []);
	root = getRoot(histories);
	draw(root);
}

// Config file reader
document.getElementById('import').onclick = function () {
	const {files} = document.getElementById('selectFiles');
	if (files.length <= 0) {
		return false;
	}

	const fr = new FileReader();
	fr.onload = function (e) {
		histories = JSON.parse(e.target.result);
		root = getRoot(histories);
		draw(root);
	};

	fr.readAsText(files.item(0));
};

// Config file saver
document.getElementById('export').onclick = function () {
	const a = document.createElement('a');
	const file = new Blob([JSON.stringify(omitDeep(histories, 'probability'), null, 2)], {type: 'application/json'});
	a.href = URL.createObjectURL(file);
	a.download = 'histories.json';
	a.click();
};
