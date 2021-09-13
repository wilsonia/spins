import {complex, matrix, kron, ctranspose, multiply, add, trace, identity, re, cos, sin, exp, pi} from 'mathjs';
import eachDeep from 'deepdash/eachDeep';
import get from 'lodash/get';

/*
	Returns a spin-up or spin-down state in the basis defined by polar angle theta and azimuthal angle phi
*/
function spinState(up, theta, phi) {
	return up ? matrix([[cos(theta / 2), multiply(sin(theta / 2), exp(complex(0, phi)))]])
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
	Maps a history schema eventId to an event operator
	This contains definitions of the Sx, Sy, and Sz bases
*/
function eventProjector(event, basis, theta, phi) {
	switch (basis) {
		case 'z':
			return projector(spinState((event === 'spinUp') ? 1 : 0, 0, 0));
		case 'x':
			return projector(spinState((event === 'spinUp') ? 1 : 0, pi / 2, 0));
		case 'y':
			return projector(spinState((event === 'spinUp') ? 1 : 0, pi / 2, pi / 2));

		default:
			return projector(spinState((event === 'spinUp') ? 1 : 0, Number(theta), Number(phi)));
	// }
	}
}

/*
   Calculates the probabilities for a consistent set of histories (formatted as a tree of events, see history schema).
	 Deepdash traverses the tree, and assigns each endpoint (leaf) a class operator.
	 The class operator is used to compute history probability, which is then assigned as the leaf's value.
*/
function computeProbabilities(histories) {
	return eachDeep(histories, (value, key, parent, context) => {
		let history = identity(2);
		let path = [];
		context.path.filter(element => (element !== 'children')).forEach(element => {
			path = path.concat(['children', element]);
			const {basis, event, theta, phi} = get(histories, path);
			history = multiply(eventProjector(event, basis, theta, phi), history);
		});
		value.probability = probability(history);
		return value;
	}, {leavesOnly: true, childrenPath: 'children', pathFormat: 'array'});
}

export {computeProbabilities};
