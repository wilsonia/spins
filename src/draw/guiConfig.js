import * as d3 from 'd3';

export const nodeLength = 120;
export const margin = {top: nodeLength, right: nodeLength, bottom: nodeLength * 1.5, left: nodeLength};
export const width = 1300;
export const dx = 65;
export const dy = width / 8;
export const diagonal = d3
	.linkHorizontal()
	.x(d => d.y - (dy / 4))
	.y(d => d.x);
export const tree = d3.tree().nodeSize([dx + (nodeLength / 2), dy + (nodeLength / 2)]);
export const svg = d3
	.create('svg')
	.attr('viewBox', [-margin.left, -margin.top, width, dx])
	.style('font', '10px sans-serif')
	.style('user-select', 'none');
document.querySelector('#app').appendChild(svg.node());
