import {sqrt, complex, matrix, kron, ctranspose, multiply, add, trace, re} from 'mathjs';

// Eigenstates
const zUpBra = matrix([[1, 0]]);
const zDownBra = matrix([[0, 1]]);
const zUpKet = ctranspose(zUpBra);
const zDownKet = ctranspose(zDownBra);

const xUpBra = matrix([[1 / sqrt(2), 1 / sqrt(2)]]);
const xDownBra = matrix([[1 / sqrt(2), -1 / sqrt(2)]]);
const xUpKet = ctranspose(xUpBra);
const xDownKet = ctranspose(xDownBra);

const yUpBra = matrix([[1 / sqrt(2), complex(0, 1 / sqrt(2))]]);
const yDownBra = matrix([[1 / sqrt(2), complex(0, -1 / sqrt(2))]]);
const yUpKet = ctranspose(yUpBra);
const yDownKet = ctranspose(yDownBra);

// Projectors
const zUpProj = kron(zUpKet, zUpBra);
const zDownProj = kron(zDownKet, zDownBra);

const xUpProj = kron(xUpKet, xUpBra);
const xDownProj = kron(xDownKet, xDownBra);

const yUpProj = kron(yUpKet, yUpBra);
const yDownProj = kron(yDownKet, yDownBra);

/*
   Leaving the oven, the electron's initial spin state is effectively random due to ignorance of its history.
   This is best represented by a mixed-state density matrix
*/
let densityOperator = add(multiply(zUpProj, 1 / 2), multiply(zDownProj, 1 / 2));

// Born Rule for a quantum history (passed as a branch wavefunction)
function probability(history) {
	// Function re() is present because of the nature of mathjs complex numbers, not physics
	return re(trace(multiply(ctranspose(history), densityOperator, history)));
}

// Example: measure Sz, then Sx
// density operator is initialized with t1 event, now adding t2


console.log(probability(multiply(yDownProj, zUpProj)));
