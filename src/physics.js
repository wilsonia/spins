import {complex, matrix, kron, ctranspose, multiply, add, trace, re, identity, cos, sin, exp, pi} from 'mathjs';
import mapValuesDeep from 'deepdash/mapValuesDeep';

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
function event(eventId) {
	const [basis, spin, theta, phi] = eventId.split(',');
	switch (basis) {
		case 'z':
			return projector(spinState((spin === 'up') ? 1 : 0, 0, 0));
		case 'x':
			return projector(spinState((spin === 'up') ? 1 : 0, pi / 2, 0));
		case 'y':
			return projector(spinState((spin === 'up') ? 1 : 0, pi / 2, pi / 2));

		default:
			return projector(spinState((spin === 'up') ? 1 : 0, Number(theta), Number(phi)));
	}
}

/*
   Calculates the probabilities for a consistent set of histories (formatted as a tree of events, see history schema).
	 Deepdash traverses the tree, and assigns each endpoint (leaf) a class operator.
	 The class operator is used to compute history probability, which is then assigned as the leaf's value.
*/
function computeProbabilities(histories) {
	return mapValuesDeep(histories, (value, key, parent, context) => {
		// Function identity() is present because mathjs.multiply() requires at least 2 arguments, and the path may only produce 1
		const history = multiply(identity(2), ...context.path.map(eventId => event(eventId)));
		return probability(history);
	}, {leavesOnly: true, pathFormat: 'array'});
}

export {computeProbabilities};
