import {sqrt, complex, matrix, kron, ctranspose, multiply, add, trace, re} from 'mathjs';

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
   Leaving the oven, the electron's initial spin state is effectively random due to ignorance of its history.
   This is best represented by a mixed-state density matrix
*/
const densityOperator = add(multiply(projector(spinStates.zUp), 1 / 2), multiply(projector(spinStates.zDown), 1 / 2));

// Born Rule for a quantum history (passed as a branch wavefunction)
function probability(history) {
	// Function re() is present because of the nature of mathjs complex numbers, not physics
	return re(trace(multiply(ctranspose(history), densityOperator, history)));
}

export {spinStates, projector, probability};
