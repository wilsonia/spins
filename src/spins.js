import { sqrt, complex, matrix, kron, transpose, multiply, add } from 'mathjs'

// Naming relevant objects
	// Eigenstates
	const z_up_bra = matrix([[1, 0]])
	const z_down_bra = matrix([[0, 1]])
	const z_up_ket = transpose(z_up_bra)
	const z_down_ket = transpose(z_down_bra)

	const x_up_bra = matrix([1/sqrt(2), 1/sqrt(2)])
	const x_down_bra = matrix([1/sqrt(2), -1/sqrt(2)])
	const x_up_ket = transpose(x_up_bra)
	const x_down_ket = transpose(x_down_bra)

	const y_up_bra = matrix([1/sqrt(2), complex(0,1/sqrt(2))])
	const y_down_bra = matrix([1/sqrt(2), complex(0,-1/sqrt(2))])
	const y_up_ket = transpose(y_up_bra)
	const y_down_ket = transpose(y_down_bra)

	// Projectors
	const p_z_up = kron(z_up_bra, z_up_ket)
	const p_z_down = kron(z_down_bra, z_down_ket)

/*
   Leaving the oven, the electron's initial spin state is effectively random due to ignorance of its history.
   This is best represented by a mixed-state density matrix
*/
var density_operator =  add(multiply(p_z_up, 1/2), multiply(p_z_down, 1/2))

console.log(density_operator)
