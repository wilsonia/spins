// Frequently used complex numbers:
var cZero = {re:0.0, im:0.0};
var cOne = {re:1.0, im:0.0};
var cMinusOne = {re:-1.0, im:0.0};
var cI = {re:0.0, im:1.0};
var cMinusI = {re:0.0, im:-1.0};
var cHalf = {re:0.5, im:0.0};
var cMinusHalf = {re:-0.5, im:0.0};
var c1overRoot2 = cSet(1/Math.sqrt(2), 0);

// Vectors and matrices that we'll need:
var oper;				// list operator matrices
var eigenVector;		// list of operator eigenvectors
var iVector;			// list of initial state vectors
var identity;			// identity matrix

// ********** Physics code ***********

// Function to send one particle through the experiment:
// (This is quite a kludge, using totally different logic depending on whether "coherent" is true.)
function sendOneThrough() {
	if (coherent) {
		var r = Math.random();		// random number between 0 and 1
		for (var c=0; c<counterList.length; c++) {
			if (r < counterList[c].prob) {
				component[counterList[c].index].count++;
				if (component[counterList[c].index].count > counterScale) counterScale *= 10;
				return;
			} else {
				r -= counterList[c].prob;
			}
		}
	} else {
		var nextComponent = component[0].out;
		if (nextComponent == 0) return;
		var initialStateVector;
		if (initialState == 0) {
			var r = Math.floor(Math.random() * dim);
			initialStateVector = eigenVector[2][r];		// use a randomly chosen Z-basis vector
		} else {
			initialStateVector = iVector[initialState];
		}
		sendIn(initialStateVector, nextComponent);
	}
}

// Recursive function to send a particle with a given state into a given component:
// (This is used only when coherent is false.)
function sendIn(state, c) {
	if (component[c].type == 1) {			// analyzer
		var prob = [];	// array of probabilities for going out each possible way
		for (var i=0; i<dim; i++) {
			prob[i] = cSquareMod(dotProduct(component[c].eigenVector[i], state));	// Born rule
		}
		var r = Math.random();	// random number between 0 and 1
		var chosenOut;
		if (r < prob[0]) {
			chosenOut = 0;
		} else if (r < prob[0]+prob[1]) {
			chosenOut = 1;
		} else {
			chosenOut = dim - 1;
		}
		var nextComponent = component[c].out[chosenOut];
		if (nextComponent > 0) {
			sendIn(component[c].eigenVector[chosenOut], nextComponent);		// collapse postulate
		}
	} else if (component[c].type == 2) {	// magnet
		if (component[c].out > 0) sendIn(mVecMul(component[c].propagator, state), component[c].out);	// multiply state by propagator matrix
	} else if (component[c].type == 3) {	// counter
		component[c].count++;
		if (component[c].count > counterScale) counterScale *= 10;
	}
}

// Function to compute probabilities associated with arriving in all counters:
// (Called whenever the experiment is modified, but these probabilities are used only if coherent is true.)
function computeProbabilities() {
	//console.log("Computing probabilities");
	// First create the list of all counters.  Each gets a component index and a probability:
	counterList = [];
	var counterCount = 0;
	for (var c=0; c<component.length; c++) {
		if (component[c].type == 3) {
			counterList[counterCount] = {};
			counterList[counterCount].index = c;
			counterList[counterCount].prob = 0;
			counterCount++;
		}
	}
	if (initialState == 0) {			// random initial state means we average over basis vectors
		for (var i=0; i<dim; i++) {
			computeAmplitudes(eigenVector[2][i]);	// use the Z basis (for no particular reason)
			for (var c=0; c<counterList.length; c++) {
				counterList[c].prob += cSquareMod(component[counterList[c].index].amp);
			}
		}
		for (var c=0; c<counterList.length; c++) {
			counterList[c].prob /= dim;				// we actually want averages, not sums
		}
	} else {
		computeAmplitudes(iVector[initialState]);	// otherwise we have a definite initial state
		for (var c=0; c<counterList.length; c++) {
			counterList[c].prob = cSquareMod(component[counterList[c].index].amp);
		}
	}
}

// Compute the complex amplitudes to arrive in each counter, for a given initial state vector:
// (These amplitudes are used only when coherent is true.)
function computeAmplitudes(iState) {
	for (var c=0; c<counterList.length; c++) {
		component[counterList[c].index].amp = cZero;	// first set them all to zero
	}
	var nextComponent = component[0].out;
	if (nextComponent != 0) {
		nextStep(iState, cOne, nextComponent);			// starting amplitude is 1
	}
}

// Recursive function to carry out the next step in the amplitude calculation:
// Parameters are incoming state, amplitude so far, and index of component we're entering.
// Note that the logic here could fail if multiple paths fed into the same counter or magnet.
// That's why the mouseOrTouchEnd function doesn't let the user make such connections.
function nextStep(state, amplitude, c) {
	if (component[c].type == 1) {			// analyzer
		for (var i=0; i<dim; i++) {
			var nextComponent = component[c].out[i];
			if (nextComponent > 0) {
				var newAmp = cMul(amplitude, dotProduct(component[c].eigenVector[i], state));	// factor-in the amplitude for this step
				nextStep(component[c].eigenVector[i], newAmp, nextComponent);
			}
		}
	} else if (component[c].type == 2) {	// magnet
		if (component[c].out > 0) nextStep(mVecMul(component[c].propagator, state), amplitude, component[c].out);	// multiply state by propagator matrix
	} else if (component[c].type == 3) {	// counter
		component[c].amp = cAdd(component[c].amp, amplitude);
	}
}

// Function to set the eigenvectors of an analyzer:
function setEigenvectors(c) {
	if (component[c].orientation < 3) {
		// component[c].eigenVector = eigenVector[component[c].orientation];
		// The preceding line introduces errors because it merely changes a pointer, so subsequent
		// changes to component[c].eigenVector also change the original!  So dig down to primitive pieces:
		component[c].eigenVector = [];
		for (var i=0; i<dim; i++) {		// loop over eigenvectors
			component[c].eigenVector[i] = [];
			for (var j=0; j<dim; j++) {		// loop over components
				component[c].eigenVector[i][j] = {re:0, im:0};
				component[c].eigenVector[i][j].re = eigenVector[component[c].orientation][i][j].re;
				component[c].eigenVector[i][j].im = eigenVector[component[c].orientation][i][j].im;
			}
		}
	} else {
		if (dim == 2) {
			var thetaOver2 = component[c].angle * Math.PI / 360;	// in radians
			var cosThetaOver2 = Math.cos(thetaOver2);
			var sinThetaOver2 = Math.sin(thetaOver2);
			component[c].eigenVector[0] = makeVector(cSet(cosThetaOver2,0), cSet(sinThetaOver2,0));
			component[c].eigenVector[1] = makeVector(cSet(sinThetaOver2,0), cSet(-cosThetaOver2,0));
		} else {
			var theta = component[c].angle * Math.PI / 180;			// in radians
			var cosTheta = Math.cos(theta);
			var sinTheta = Math.sin(theta);
			var sqrt2 = Math.sqrt(2);
			component[c].eigenVector[0] = makeVector(cSet((1+cosTheta)/2,0), cSet(sinTheta/sqrt2,0), cSet((1-cosTheta)/2,0));
			component[c].eigenVector[1] = makeVector(cSet(sinTheta/sqrt2,0), cSet(-cosTheta,0), cSet(-sinTheta/sqrt2,0));
			component[c].eigenVector[2] = makeVector(cSet((1-cosTheta)/2,0), cSet(-sinTheta/sqrt2,0), cSet((1+cosTheta)/2,0));
		}
	}
}

// Function to calculate the propagator matrix for a magnet/rotator component.
// The formula is exp(-iHt) = 1 - i*sin(theta)*H + (cos(theta)-1)*H^2,
// and apparently it works as long as the eigenvalues of H are all 1, -1, or 0.
// (I pulled this from my old Pascal code and I have no recollection of whether
// I derived the formula at that time, or how I even learned of its existence.)
function setPropagator(c) {
	var theta = 2 * Math.PI * component[c].count / 72;
	var H = oper[component[c].orientation];
	var sum = identity;
	sum = mAdd(sum, mScalarMul(cSet(0,-Math.sin(theta)), H));
	sum = mAdd(sum, mScalarMul(cSet(Math.cos(theta)-1, 0), mSquare(H)));
	component[c].propagator = sum;
}

// Initialize the identity matrix (needed in setPropagator function):
for (var i=0; i<dim; i++) {
	identity[i] = [];
	for (var j=0; j<dim; j++) {
		if (j==i) {
			identity[i][j] = cOne;
		} else {
			identity[i][j] = cZero;
		}
	}
}
}	// end of function initVectors

// ********** Auxiliary math code for complex numbers, vectors, and matrices ***********

// Complex numbers and arithmetic:
// A complex number is represented as a JavaScript object, with parts re and im.
function cSet(realpart, imagpart) {
var result = {re:0, im:0};
result.re = realpart;
result.im = imagpart;
return result;
}
function cAdd(c1, c2) {
var result = {re:0, im:0};
result.re = c1.re + c2.re;
result.im = c1.im + c2.im;
return result;
}
function cMul(c1, c2) {
var result = {re:0, im:0};
result.re = c1.re*c2.re - c1.im*c2.im;
result.im = c1.re*c2.im + c1.im*c2.re;
return result;
}
function cConj(c) {
var result = {re:0, im:0};
result.re = c.re;
result.im = -c.im;
return result;
}
function cSquareMod(c) {
return c.re*c.re + c.im*c.im;
}

// Vector manipulation functions
// A vector is represented as an array of 2 or 3 complex numbers, depending on the value of dim.
function makeVector() {
var result = [];
for (var i=0; i<dim; i++) {
	result[i] = arguments[i];
}
return result;
}
function dotProduct(v1, v2) {
var result = cZero;
for (var i=0; i<dim; i++) {
	result = cAdd(result, cMul(cConj(v1[i]),v2[i]));
}
return result;
}

// Matrix arithmetic functions
// A matrix is an array of arrays of complex numbers.
// First index is row, second is column, starting from 0.
function mAdd(m1, m2) {		// add matrices m1 and m2
var result = [];
for (var i=0; i<dim; i++) {
	result[i] = [];
	for (var j=0; j<dim; j++) {
		result[i][j] = cAdd(m1[i][j], m2[i][j]);
	}
}
return result;
}
function mScalarMul(s, m) {		// multiply matrix m by scalar s
var result = [];
for (var i=0; i<dim; i++) {
	result[i] = [];
	for (var j=0; j<dim; j++) {
		result[i][j] = cMul(s, m[i][j]);
	}
}
return result;
}
function mVecMul(m, v) {	// multiply matrix m by column vector v
var result = [];
for (var i=0; i<dim; i++) {
	result[i] = cZero;
	for (var j=0; j<dim; j++) {
		result[i] = cAdd(result[i], cMul(m[i][j], v[j]));
	}
}
return result;
}
function mSquare(m) {	// square the matrix m
var result = [];
for (var i=0; i<dim; i++) {
	result[i] = [];
	for (var j=0; j<dim; j++) {
		result[i][j] = cZero;
		for (var k=0; k<dim; k++) {
			result[i][j] = cAdd(result[i][j], cMul(m[i][k], m[k][j]));
		}
	}
}
return result;
}
