import {sqrt, complex, matrix, kron, transpose, multiply, add} from 'mathjs';

// Eigenstates
const zUpBra = matrix([[1, 0]]);
const zDownBra = matrix([[0, 1]]);
const zUpKet = transpose(zUpBra);
const zDownKet = transpose(zDownBra);

const xUpBra = matrix([1 / sqrt(2), 1 / sqrt(2)]);
const xDownBra = matrix([1 / sqrt(2), -1 / sqrt(2)]);
const xUpKet = transpose(xUpBra);
const xDownKet = transpose(xDownBra);

const yUpBra = matrix([1 / sqrt(2), complex(0, 1 / sqrt(2))]);
const yDownBra = matrix([1 / sqrt(2), complex(0, -1 / sqrt(2))]);
const yUpKet = transpose(yUpBra);
const yDownKet = transpose(yDownBra);

// Projectors
const zUpProj = kron(zUpBra, zUpKet);
const zDownProj = kron(zDownBra, zDownKet);

const xUpProj = kron(xUpBra, xUpKet);
const xDownProj = kron(xDownBra, xDownKet);

const yUpProj = kron(yUpBra, yUpKet);
const yDownProj = kron(yDownBra, yDownKet);

/*
   Leaving the oven, the electron's initial spin state is effectively random due to ignorance of its history.
   This is best represented by a mixed-state density matrix
*/
let densityOperator = add(multiply(zUpProj, 1 / 2), multiply(zDownProj, 1 / 2));

// Born Rule for a quantum history
function probability(history) {
	return multiply(transpose(history), densityOperator, history);
}

console.log(probability(yDownKet));
