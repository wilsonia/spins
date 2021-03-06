import {computeProbabilities} from './physics.js';
import {basisClick, counterClick, counterBlockClick, eventClick, magnetClick} from './clicks';
import presetExperiments from './presetExperiments.json';
import {nodeLength, margin, width, dx, dy, diagonal, tree, svg} from './draw/guiConfig.js';
import * as d3 from 'd3';
import {sliderHorizontal} from 'd3-simple-slider';
import set from 'lodash/set';
import get from 'lodash/get';
import initial from 'lodash/initial';
import findIndex from 'lodash/findIndex';
import katex from 'katex';
import findDeep from 'deepdash/findDeep';
import eachDeep from 'deepdash/eachDeep';

// Import math modules in a way that minimizes bundle size
import {create, roundDependencies, piDependencies, randomDependencies} from '../mathjs/lib/esm/index.js';
const {round, pi, random} = create({roundDependencies, piDependencies, randomDependencies});

// Default experimental setup
const urlString = window.location.href;
const url = new URL(urlString);
const experiment = url.searchParams.get('experiment');
let histories = JSON.parse(JSON.stringify(experiment ? presetExperiments[experiment] : presetExperiments.one));

// Draw tree
let root = getRoot(histories);
draw(root);

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

		// Label count at leaves
		if (d.data.children.length === 0) {
			d.probability = d.data.probability;
			d.data.count = 0;
		}
	});

	// Handle conditional probabilities
	let ignoredEventProbabilitySum = 0;
	eachDeep(root, value => {
		if (value.data.ignored === true) {
			ignoredEventProbabilitySum += value.data.probability;
			value.data.probability = 0;
		}
	}, {leavesOnly: true, childrenPath: 'children'});

	if (ignoredEventProbabilitySum) {
		eachDeep(root, value => {
			value.data.probability /= ignoredEventProbabilitySum;
		}, {leavesOnly: true, childrenPath: 'children'});
	}

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

	// Draw oven
	const oven = gNode.selectAll('g').data(nodes.filter(
		node => (node.data.children[0] !== undefined)).filter(
		node => node.data.children[0].event === 'oven'));
	drawOven(oven, source);

	// Draw analyzers
	const analyzers = gNode.selectAll('g').data(nodes.filter(
		node => (node.data.children[0] !== undefined)).filter(
		node => node.data.children[0].event !== 'magnet').filter(
		node => node.data.children[0].event !== 'identity').filter(
		node => node.data.children[0].event !== 'oven'), d => d.id);
	drawAnalyzers(analyzers, source);

	const analyzersIgnorable = gNode.selectAll('g').data(nodes.filter(
		node => (node.data.children[0] !== undefined)).filter(
		node => node.data.children[0].event !== 'magnet').filter(
		node => node.data.children[0].event === 'identity'), d => d.id);
	drawAnalyzersIgnorable(analyzersIgnorable, source);

	// Draw magnets
	const magnets = gNode.selectAll('g').data(nodes.filter(
		node => (node.data.children[0] !== undefined)).filter(
		node => (node.data.children[0].event === 'magnet')), d => d.id);
	drawMagnets(magnets, source);

	// Draw counters
	const counters = gNode.selectAll('g').data(nodes.filter(node => (
		node.data.probability !== undefined && node.data.ignored !== true)), d => d.id);
	drawCounters(counters, source);

	// Draw counter blocks
	const counterBlocks = gNode.selectAll('g').data(nodes.filter(node => (
		node.data.probability !== undefined && node.data.ignored === true)), d => d.id);
	drawCounterBlocks(counterBlocks, source);

	// Update the links???
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
		.on('mousedown', click => {
			stop();
			root = getRoot(eventClick(click, 'spinUp', histories));
			draw(root);
		});

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
		.on('mousedown', click => {
			stop();
			root = getRoot(eventClick(click, 'spinDown', histories));
			draw(root);
		});

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
		.on('mousedown', click => {
			stop();
			root = getRoot(basisClick(click, histories));
			draw(root);
		});

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
		.on('mousedown', click => {
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
		.on('mousedown', click => {
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

function drawOven(oven, source) {
	const ovenEnter = oven
		.enter()
		.append('g')
		.attr('transform', `translate(${source.y0},${source.x0})`)
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0);
	// Draw outline
	ovenEnter
		.append('rect')
		.attr('width', nodeLength)
		.attr('x', -1 * (nodeLength / 2))
		.attr('y', -1 * (nodeLength / 2))
		.attr('height', nodeLength)
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey');

	// Draw collimator
	ovenEnter
		.append('rect')
		.attr('width', nodeLength / 3)
		.attr('x', nodeLength / 2)
		.attr('y', -nodeLength / 6)
		.attr('height', nodeLength / 3)
		.attr('fill-opacity', 0)
		.attr('stroke-width', 2)
		.attr('stroke', 'grey');

	// Draw collimator lines
	const collimatorLinePositions = [
		[(nodeLength / 2) + (nodeLength / 12), -nodeLength / 6],
		[(nodeLength / 2) + (nodeLength / 12), nodeLength / 24],
		[(nodeLength / 2) + (nodeLength / 6), -nodeLength / 6],
		[(nodeLength / 2) + (nodeLength / 6), nodeLength / 24],
		[(nodeLength / 2) + (nodeLength / 4), -nodeLength / 6],
		[(nodeLength / 2) + (nodeLength / 4), nodeLength / 24],
	];
	collimatorLinePositions.forEach(position => {
		ovenEnter
			.append('rect')
			.attr('width', 1)
			.attr('x', position[0])
			.attr('y', position[1])
			.attr('height', nodeLength / 8)
			.attr('fill-opacity', 0)
			.attr('stroke-width', 2)
			.attr('stroke', 'grey');
	});

	// Label oven
	ovenEnter
		.append('foreignObject')
		.attr('x', -0.35 * nodeLength)
		.attr('y', -0.35 * nodeLength)
		.attr('width', nodeLength)
		.attr('height', nodeLength / 2)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(katex.renderToString('\\Huge{\\textrm{oven}}'));

	oven
		.merge(ovenEnter)
		.attr('transform', d => `translate(${d.y},${d.x})`)
		.attr('fill-opacity', 1)
		.attr('stroke-opacity', 1);
}

function drawAnalyzersIgnorable(analyzers, source) {
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
		.on('mousedown', click => {
			stop();
			root = getRoot(eventClick(click, 'spinUp', histories));
			draw(root);
		});

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
		.on('mousedown', click => {
			stop();
			root = getRoot(eventClick(click, 'spinDown', histories));
			draw(root);
		});

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
		.on('mousedown', click => {
			stop();
			root = getRoot(basisClick(click, histories));
			draw(root);
		});

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
		.on('mousedown', click => {
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
		.on('mousedown', click => {
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
		.on('mousedown', click => {
			stop();
			root = getRoot(magnetClick(click, histories));
			draw(root);
		});

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
		.on('mousedown', click => {
			stop();
			root = getRoot(basisClick(click, histories));
			draw(root);
		});

	magnetEnter
		.append('foreignObject')
		.attr('x', -0.5 * nodeLength)
		.attr('y', -0.24 * nodeLength)
		.attr('width', nodeLength)
		.attr('height', nodeLength / 3)
		.style('pointer-events', 'none')
		.append('xhtml:body')
		.html(d => katex.renderToString(`\\Large{\\omega t = ${d.magnitude}}`));

	magnetEnter
		.append('rect')
		.attr('x', -1 * nodeLength / 2)
		.attr('y', -0.24 * nodeLength)
		.attr('width', 3 * nodeLength / 4)
		.attr('height', nodeLength / 4)
		.attr('opacity', 0)
		.on('mousedown', click => {
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
				.html(katex.renderToString('\\LARGE{\\omega t = \\frac{e}{m_e} |\\vec{B}| t}'));
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
		.on('mousedown', click => {
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
		.on('mousedown', click => {
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

function drawCounterBlocks(counterBlocks, source) {
	const counterBlockEnter = counterBlocks
		.enter()
		.append('g')
		.attr('transform', `translate(${source.y0},${source.x0})`)
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0);

	counterBlockEnter
		.append('rect')
		.attr('width', 0.02 * nodeLength)
		.attr('x', -0.35 * nodeLength)
		.attr('y', -nodeLength / 8)
		.attr('height', nodeLength / 4)
		.attr('fill', 'grey')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey');

	counterBlockEnter
		.append('rect')
		.attr('width', 0.2 * nodeLength)
		.attr('x', -0.425 * nodeLength)
		.attr('y', -nodeLength / 8)
		.attr('height', nodeLength / 4)
		.attr('fill', 'transparent')
		.attr('stroke-width', 2)
		.attr('stroke', 'transparent')
		.on('mousedown', click => {
			stop();
			root = getRoot(counterBlockClick(click, histories));
			draw(root);
		});

	counterBlocks
		.merge(counterBlockEnter)
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
		.attr('y', -0.4 * nodeLength)
		.append('xhtml:body')
		.html(d => katex.renderToString(`\\LARGE{${d.data.count}}`));

	counterEnter
		.append('rect')
		.attr('width', 0.7 * nodeLength)
		.attr('x', -0.3 * nodeLength)
		.attr('y', -nodeLength / 16)
		.attr('height', nodeLength / 8)
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey')
		.on('mousedown', click => {
			stop();
			root = getRoot(counterClick(click, histories));
			draw(root);
		});

	counterEnter
		.append('rect')
		.attr('width', d => (0.7 * nodeLength) * (d.data.count / 100))
		.attr('x', -0.3 * nodeLength)
		.attr('y', -nodeLength / 16)
		.attr('height', nodeLength / 8)
		.attr('fill', 'LightSteelBlue')
		.attr('stroke-width', 2)
		.attr('stroke', 'grey')
		.on('mousedown', click => {
			stop();
			root = getRoot(counterClick(click, histories));
			draw(root);
		});

	counters
		.merge(counterEnter)
		.attr('transform', d => `translate(${d.y},${d.x})`)
		.attr('fill-opacity', 1)
		.attr('stroke-opacity', 1);
}

function slider(click, parameter) {
	stop();
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
	return sliderHorizontal().min(0).max(2 * pi).step(0.01).displayFormat(d3.format('.2f')).width(dy * 2).default(parameterInit)
		.on('end', value => {
			histories = set(histories, path, get(histories, path).map(child => {
				child[parameter] = round(value, 2);
				return child;
			}));

			root = getRoot(histories);
			draw(root);
		});
}

function recordEvent() {
	// Choose a history
	const sample = random();
	let probabilitySum = 0;
	const branch = findDeep(root, (value, key) => {
		if (key === 'probability') {
			probabilitySum += value;
			return (probabilitySum >= sample) || (probabilitySum === 1);
		}

		return false;
	}, {pathFormat: 'array', leavesOnly: true});
	const path = initial(branch.context._item.path);
	const count = branch.parent.count + 1;
	if (count > 100) {
		root = getRoot(histories);
		draw(root);
	} else {
		set(root, path.concat(['count']), count);
		draw(root);
	}
}

// Start/stop
let eventRecorder = null;
function stop() {
	clearInterval(eventRecorder);
	eventRecorder = null;
	document.getElementById('enable').innerHTML = 'Start';
}

document.getElementById('enable').onclick = function () {
	if (eventRecorder) {
		stop();
	} else {
		eventRecorder = setInterval(() => {
			recordEvent();
		}, 10);
		document.getElementById('enable').innerHTML = 'Stop';
	}
};

// Reset counters
document.getElementById('reset').onclick = function () {
	root = getRoot(histories);
	draw(root);
};

// Preset experiment chooser
document.getElementById('experiment').onchange = function (selectObject) {
	stop();
	histories = JSON.parse(JSON.stringify({
		1: presetExperiments.one,
		2: presetExperiments.two,
		3: presetExperiments.three,
		'4a': presetExperiments.fourA,
		'4b': presetExperiments.fourB,
		'4c': presetExperiments.fourC,
	}[selectObject.target.value]));
	root = getRoot(histories);
	draw(root);
};

// Config file reader
document.getElementById('selectFiles').onclick = function () {
	document.getElementById('selectFiles').value = null;
};

document.getElementById('selectFiles').onchange = function () {
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
	const file = new Blob([JSON.stringify(histories, null, 2)], {type: 'application/json'});
	a.href = URL.createObjectURL(file);
	a.download = 'histories.json';
	a.click();
};
