import eachDeep from 'deepdash/eachDeep';
import get from 'lodash/get';

// Import math modules in a way that minimizes bundle size
import {create, complexDependencies, matrixDependencies, kronDependencies, ctransposeDependencies, multiplyDependencies, addDependencies, traceDependencies, identityDependencies, reDependencies, cosDependencies, sinDependencies, powDependencies, expDependencies, expmDependencies, piDependencies} from '../mathjs/lib/esm/index.js';
const {complex, matrix, kron, ctranspose, multiply, add, trace, identity, re, cos, sin, exp, expm, pi} = create({complexDependencies, matrixDependencies, kronDependencies, ctransposeDependencies, multiplyDependencies, addDependencies, traceDependencies, identityDependencies, reDependencies, cosDependencies, sinDependencies, powDependencies, expDependencies, expmDependencies, piDependencies});

const spinOrientations = {
	z: {
		theta: 0,
		phi: 0,
	},
	x: {
		theta: pi / 2,
		phi: 0,
	},
	y: {
		theta: pi / 2,
		phi: pi / 2,
	},
};

// Returns a spin-up or spin-down state in the basis defined by polar angle theta and azimuthal angle phi
function spinState(spin, theta, phi) {
	return spin ? matrix([[cos(theta / 2), multiply(sin(theta / 2), exp(complex(0, phi)))]])
		: matrix([[sin(theta / 2), multiply(-cos(theta / 2), exp(complex(0, phi)))]]);
}

function projector(state) {
	return kron(ctranspose(state), state);
}

/*
   Leaving the oven, the electron's initial spin state is effectively random due to ignorance of its history
   This is best represented by a mixed-state density matrix
*/
const densityOperator = add(multiply(projector(spinState(1, 0, 0)), 1 / 2), multiply(projector(spinState(0, 0, 0)), 1 / 2));

// Born Rule for a quantum history (expects a class operator)
function probability(history) {
	// Function re() is present because of the nature of mathjs complex numbers, not physics
	return re(trace(multiply(ctranspose(history), densityOperator, history)));
}

/*
	Returns a time evolution operator for a uniform magnetic field,
 	oriented in direction defined by polar angle theta and azimuthal angle phi.
*/
function magnetPropagator(theta, phi, magnitude) {
	return expm(matrix(
		[
			[
				complex(0, -magnitude * cos(theta)),
				multiply(complex(0, -magnitude * sin(theta)), exp(complex(0, -phi))),
			],
			[
				multiply(complex(0, -magnitude * sin(theta)), exp(complex(0, phi))),
				complex(0, magnitude * cos(theta)),
			],
		],
	));
}

/*
   Calculates the probabilities for a consistent set of histories (formatted as a tree of events, see history schema).
	 Deepdash traverses the tree, and assigns each endpoint (leaf) a class operator.
	 The class operator is used to compute history probability, which is then assigned as the leaf's value.
*/
function computeProbabilities(histories) {
	const historiesCopy = JSON.parse(JSON.stringify(histories));
	return eachDeep(historiesCopy, (value, key, parent, context) => {
		let history = identity(2);
		let path = [];
		context.path.filter(element => (element !== 'children')).forEach(element => {
			path = path.concat(['children', element]);
			let {basis, event, theta, phi, magnitude} = get(histories, path);
			theta = theta ?? spinOrientations[basis].theta;
			phi = phi ?? spinOrientations[basis].phi;
			switch (event) {
				case 'magnet':
					history = multiply(magnetPropagator(theta, phi, magnitude), history);
					break;
				case 'spinUp':
					history = multiply(projector(spinState(true, theta, phi)), history);
					break;
				case 'spinDown':
					history = multiply(projector(spinState(false, theta, phi)), history);
					break;
				default:
					break;
			}
		});
		value.probability = probability(history);
		return value;
	}, {leavesOnly: true, childrenPath: 'children', pathFormat: 'array'});
}

export {computeProbabilities};
