# Spins Laboratory Simulation

This project is a re-write of [Daniel V. Schroeder's spins laboratory simulation](https://physics.weber.edu/schroeder/software/Spins.html), which supplements the first three chapters of [David McIntyre's introductory Quantum Mechanics textbook](https://www.pearson.com/us/higher-education/program/Mc-Intyre-Quantum-Mechanics/PGM64990.html).

The program simulates the results of consecutive ideal measurements of electron spin. Mirroring the textbook, experimental setups are displayed as tree graphs with Stern-Gerlach analyzers as nodes. Experimental setups are configured by the student so that they may reckon with [complementary physical variables](https://en.wikipedia.org/wiki/Complementarity_(physics)). This simulation is a useful tool when using a [spins-first approach](file:///tmp/mozilla_geo0/PERC15_Sadaghiani.pdf) to teaching quantum mechanics.

## Demo
A [live demo](https://wilsonia.github.io/spins/) is available (work in progress).

## Motivation
This re-write is an extension of my [Bachelor's thesis research](https://nwilson.dev/quantum) in Stern-Gerlach experiments and the consistent histories approach to quantum mechanics.


It accomplishes several goals:
- Simplifies computation of probabilities by using the consistent histories approach
- Increases readability of code
- Imports/exports experiment configurations
- Eliminates physics errors in Schroeder's simulation
- Simplifies user interface
- Updates tech stack

## Stack
The simulation is written in Javascript, adhering to the ES6 specification. The project uses [node.js](https://nodejs.org/en/) for development and dependency management and [webpack](https://webpack.js.org/) for bundling the program for browser execution.
Several packages were used to reduce code volume and simplify control flow:
- [mathjs](https://mathjs.org/) for linear algebra computations
- [d3-hierarchy](https://github.com/d3/d3-hierarchy) for tree visualization
- [lodash](https://lodash.com) and [deepdash](https://deepdash.io) for tree traversal
- [katex](https://katex.org/) for math symbol rendering

## Installing
1. Install [nodejs](https://nodejs.org/en/download/) version >= v12.21.0
2. Clone the project
```shell
git clone git@github.com:wilsonia/spins.git
```
3. Navigate to the project and install dependencies
```shell
cd ./spins
npm install
```

## Building and executing
1. Bundle with webpack
```shell
npm run build
````
2. Open [index.html](index.html) in a browser. You may need to [allow CORS in Firefox](https://stackoverflow.com/a/48957475).

## mathjs
mathjs is cloned locally rather than installed via npm. This is so the `maxSearchSize` parameter may be increased for the matrix exponential approximation function `expm`. Unfortunately this parameter is not configurable, and increasing it is necessary for computing the magnet propagator.

## TODO
- Code chunking
- Clean up GUI code
- Default experiments
- Spin-1
