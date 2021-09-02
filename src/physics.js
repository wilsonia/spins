import {sqrt, complex, matrix, kron, ctranspose, multiply, add, trace, re, identity, cos, sin, exp, pi} from 'mathjs';
import mapValuesDeep from 'deepdash/mapValuesDeep';

function spinState(theta, phi, up) {
	return up ? matrix([[cos(theta / 2), sin(theta / 2) * exp(complex(0, phi))]])
		: matrix([[sin(theta / 2), -cos(theta / 2) * exp(complex(0, phi))]]);
}

// Spin eigenstates for X,Y,Z bases, in "bra" form
const spinStates = {
	zUp: matrix([[1, 0]]),
	zDown: matrix([[0, 1]]),

	xUp: matrix([[1 / sqrt(2), 1 / sqrt(2)]]),
	xDown: matrix([[1 / sqrt(2), -1 / sqrt(2)]]),

	yUp: matrix([[1 / sqrt(2), complex(0, 1 / sqrt(2))]]),
	yDown: matrix([[1 / sqrt(2), complex(0, -1 / sqrt(2))]]),
};

function projector(state) {
	return kron(ctranspose(state), state);
}

/*
   Leaving the oven, the electron's initial spin state is effectively random due to ignorance of its history
   This is best represented by a mixed-state density matrix
*/
const densityOperator = add(multiply(projector(spinStates.zUp), 1 / 2), multiply(projector(spinStates.zDown), 1 / 2));

// Born Rule for a quantum history (expects a class operator)
function probability(history) {
	// Function re() is present because of the nature of mathjs complex numbers, not physics
	return re(trace(multiply(ctranspose(history), densityOperator, history)));
}

// Maps a history schema eventId to an event operator
function event(eventId) {
	if (eventId.startsWith('n')) {

	}

	return projector(spinStates[eventId]);
}

/*
   Calculates the probabilities for a consistent set of histories (formatted as a tree of events).
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
