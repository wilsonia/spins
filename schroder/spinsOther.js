
	// ********** Global variables and initializations ***********

	// DOM elements:
	var theCanvas = document.getElementById("theCanvas");
	var ctx = theCanvas.getContext("2d");
	ctx.translate(0.5, 0.5); 	// gives sharper lines, at least in Chrome
	var canvasDiv = document.getElementById("canvasDiv");
	var newComponentMenu = document.getElementById("newComponentMenu");
	var orientationMenu = document.getElementById("orientationMenu");
	var magnetOrientationMenu = document.getElementById("magnetOrientationMenu");
	var thetaSliderBox = document.getElementById("thetaSliderBox");
	var thetaSlider = document.getElementById("thetaSlider");
	var durationSliderBox = document.getElementById("durationSliderBox");
	var dSlider = document.getElementById("dSlider");

	// Fixed properties of components:
	//var componentName = ["gun", "analyzer", "magnet", "counter"];
	var componentWidth = [120, 72, 72, 150];	// indices 0,1,2,3 for gun, analyzer, magnet, counter
	var componentHeight = [100, 72, 72, 18];
	var orientationLetter = ["X", "Y", "Z"];

	// Colors:
	var backgroundColor = "white";
	var counterEmptyColor = "#def";
	var counterFullColor = "#04c";
	var analyzerColor = "#e4d0ff";
	var magnetColor = "#fdc";
	var gunColor = "#ffb";
	var outlineColor = "black";
	var lightOutlineColor = "gray";
	var textColor = "black";
	var pathColor = "rgba(0,50,150,0.6)";
	var startButtonColor = "#6f6";
	var stopButtonColor = "#f99";
	var smallButtonColor = "#bfb";
	var smallButtonBlinkColor = "#9b9";
	var resetButtonBlinkColor = "#bcd";

	// Set dimension and labeling of analyzer outputs:
	var dim = 2;						// dimension of state space (2 or 3)
	var arrows = true;					// analyzer outputs are labeled with arrows if true or +/- if false
	var param = window.location.search;
	if (param.search("dim=3") >= 0) {	// put "?dim=3" at the end of the URL for 3-state (spin-1) system
		dim = 3;
		arrows = false;
	}



	// The components of the experiment (gun, analyzers, magnets, counters) are described by the "component"
	// array, initialized below.  Each element is an object that can have the following fields:
	//		type:			0 for gun, 1 for analyzer, 2 for magnet, 3 for counter
	//		x:				pixel location of left edge (from left edge of canvas)
	//		y:				pixel location of top edge (down from top edge of canvas)
	//		orientation:	0 for X, 1 for Y, 2 for Z, 3 for an adjustable angle
	//		angle:			orientation angle in xz plane, in degrees (only for analyzers with orientation=3)
	//		count:			the count displayed by a counter, or the duration (or strength) of a magnet
	//		out:			index of component that this one feeds into; for analyzers, a list of such indices
	//		inCount:		the number of other components that feed into this one (can exceed 1 only for analyzers)
	//		eigenVector:	for analyzers only, a list of the eigenvectors
	//		propagator:		for magnets only, the propagator matrix
	// 		amp:			for counters only, the complex amplitude to arrive here (used only temporarily)
	var component = [];

	// Still more global variables:
	var counterList = [];				// list of all counters and their associated probabilities
	var initialState = 0;				// index of initial state (0 = random)
	var running = false;				// true when we're running continuously
	var pending = 0;					// number of particles waiting to be sent through experiment
	var blink1button = false;			// momentarily true when "1" button has been pressed, so we darken it
	var blinkResetButton = false;		// momentarily true when Reset button has been pressed, so we darken it
	var counterScale = 100;				// a counter appears full at this value
	var coherent = true;				// true when recombined paths are to produce interference

	// Global variables for tracking mouse/touch interactions:
	var clickedComponent = -1;			// index of component that was clicked on, to handle drag events
	var dragStartX, dragStartY;			// previous mouse coordinates, for drag calculations
	var drawingConnection = false;		// true when a connecting line is being drawn
	var whichOut;						// index of output opening from which we're drawing a connection
	var showNewComponentMenu = false;	// true when we're displaying the new component menu
	var newComponentX, newComponentY;	// place to put the new component
	var movedSinceClick = false;		// true if mouse or touch location has moved since the click or tap
	var showOrientationMenu = false;	// true when we're displaying the menu to choose an analyzer's orientation
	var showMagOrientationMenu = false;	// true when we're displaying the menu to choose a magnet's orientation
	var showingThetaSlider = false;		// true when we're displaying the slider to set theta
	var showDurationSlider = false;		// true when we're displaying the slider to set the magnet duration

	// Add mouse/touch handlers; down/start must be inside the canvas but drag can go outside it:
	theCanvas.addEventListener('mousedown', mouseDown, false);
	theCanvas.addEventListener('touchstart', touchStart, false);

	init();

	// Initializations that get redone when dim changes are here:
	function init() {
		initVectors();

		component = [];
		component[0] = {type:0, x:80, y:160, out:1};	// this is the gun
		if (dim == 2) {
			component[1] = {type:1, x:330, y:174, orientation:0, angle:45, out:[2,3], inCount:1};	// note that dimension of "out" must match "dim"
			setEigenvectors(1);
			component[2] = {type:3, x:550, y:150, inCount:1, count:0};
			component[3] = {type:3, x:550, y:250, inCount:1, count:0};
		} else {
			component[1] = {type:1, x:330, y:174, orientation:0, angle:45, out:[2,3,4], inCount:1};
			setEigenvectors(1);
			component[2] = {type:3, x:550, y:130, inCount:1, count:0};
			component[3] = {type:3, x:550, y:201, inCount:1, count:0};
			component[4] = {type:3, x:550, y:272, inCount:1, count:0};
		}

		counterScale = 100;
		computeProbabilities();
		drawAll();
	}



	// Initialize the operator matrices and their eigenvectors (called once when page loads).
	// First index on an operator is which operator it is (Sx, Sy, Sz, respectively).
	// Second index is the matrix row number and third index is the column number (starting from 0).
	// First index on the eigenVector array is which operator it's the eigenvector of;
	// second index is which eigenvector, in descending order by eigenvalue.
	// These are just the usual spin operators for x, y, and z, respectively, with
	// matrices normalized so their eigenvalues are 1 and -1 (and 0 in the spin-1 case).
	function initVectors() {
		oper = [];				// list operator matrices
		eigenVector = [];		// list of operator eigenvectors
		iVector = [];			// list of initial state vectors
		identity = [];			// identity matrix
		for (var i=0; i<orientationLetter.length; i++) {
			oper[i] = [];
			eigenVector[i] = [];
			for (var j=0; j<dim; j++) {
				oper[i][j] = [];
				for (var k=0; k<dim; k++) {
					oper[i][j][k] = cZero;		// start with all matrix elements equal to zero (complex)
				}
			}
		}
		if (dim == 2) {
			oper[0][0][1] = cOne;	// Sx matrix
			oper[0][1][0] = cOne;
			eigenVector[0][0] = makeVector(c1overRoot2, c1overRoot2);	// Sx=1 eigenvector
			eigenVector[0][1] = makeVector(c1overRoot2, cMul(cMinusOne, c1overRoot2)); // Sx=-1 eigenvector
			oper[1][0][1] = cMinusI;	// Sy matrix
			oper[1][1][0] = cI;
			eigenVector[1][0] = makeVector(c1overRoot2, cMul(cI, c1overRoot2));		// Sy=1 eigenvector
			eigenVector[1][1] = makeVector(c1overRoot2, cMul(cMinusI, c1overRoot2));	// Sy=-1 eigenvector
			oper[2][0][0] = cOne;		// Sz matrix
			oper[2][1][1] = cMinusOne;
			eigenVector[2][0] = makeVector(cOne, cZero);	// Sz=1 eigenvector
			eigenVector[2][1] = makeVector(cZero, cOne);	// Sz=-1 eigenvector
		} else {	// Xup, X0, Xdown, Yup, Y0, Ydown, Zup, Z0, Zdown, in that order
			oper[0][0][1] = c1overRoot2;
			oper[0][1][0] = c1overRoot2;
			oper[0][1][2] = c1overRoot2;
			oper[0][2][1] = c1overRoot2;
			eigenVector[0][0] = makeVector(cHalf, c1overRoot2, cHalf);
			eigenVector[0][1] = makeVector(c1overRoot2, cZero, cMul(cMinusOne, c1overRoot2));
			eigenVector[0][2] = makeVector(cHalf, cMul(cMinusOne, c1overRoot2), cHalf);
			oper[1][0][1] = cSet(0, -1/Math.sqrt(2));
			oper[1][1][0] = cSet(0, 1/Math.sqrt(2));
			oper[1][1][2] = cSet(0, -1/Math.sqrt(2));
			oper[1][2][1] = cSet(0, 1/Math.sqrt(2));
			eigenVector[1][0] = makeVector(cHalf, cMul(cI, c1overRoot2), cMinusHalf);
			eigenVector[1][1] = makeVector(c1overRoot2, cZero, c1overRoot2);
			eigenVector[1][2] = makeVector(cHalf, cMul(cMinusI, c1overRoot2), cMinusHalf);
			oper[2][0][0] = cOne;
			oper[2][2][2] = cMinusOne;
			eigenVector[2][0] = makeVector(cOne, cZero, cZero);
			eigenVector[2][1] = makeVector(cZero, cOne, cZero);
			eigenVector[2][2] = makeVector(cZero, cZero, cOne);
		}

		// Set up the various initial state vectors.
		// (There's no iVector[0] because the zero setting gives a random initial state.)
		iVector[1] = eigenVector[1][0];
		iVector[2] = eigenVector[2][1];
		if (dim == 2) {
			iVector[3] = makeVector(cSet(1/Math.sqrt(3),0), cSet(0,Math.sqrt(2/3)));
			iVector[4] = makeVector(cSet(1/2,0), cSet(0,Math.sqrt(3/4)));
		} else {
			//iVector[2] = makeVector(cSet(Math.sqrt(1/3)-Math.sqrt(1/6),0), cZero, cSet(Math.sqrt(1/3)+Math.sqrt(1/6),0));
			iVector[2] = makeVector(cSet(1/Math.sqrt(6),0), cSet(-Math.sqrt(2/3),0), cSet(1/Math.sqrt(6),0));
			iVector[3] = makeVector(cSet(1/Math.sqrt(3),0), cSet(0,-1/Math.sqrt(3)), cSet(-1/Math.sqrt(3),0));
			iVector[4] = makeVector(cSet(Math.sqrt(2/10),0), cSet(Math.sqrt(1/10),0), cSet(Math.sqrt(7/10),0));
		}



	// ********** User interface code ***********

	// Run the experiment continuously, as long as running == true:
	function runExperiment() {
		sendOneThrough();
		drawCounters();
		if (running) window.setTimeout(runExperiment, 50);
	}

	// Send lots of particles through really fast, but not instantaneously (for animation effect):
	function sendLotsThrough() {
		for (var p=0; p<500; p++) {
			sendOneThrough();
			pending--;
			if (pending <= 0) break;
		}
		drawCounters();
		if (pending > 0) {
			window.setTimeout(sendLotsThrough, 25);
		} else {
			drawComponent(0);	// redraw when done, to end dimming of button
		}
	}

	function mouseDown(e) {
		mouseOrTouchStart(e.pageX, e.pageY, e, false);
	}

	function touchStart(e) {
		mouseOrTouchStart(e.targetTouches[0].pageX, e.targetTouches[0].pageY, e, true);
	}

	function mouseMove(e) {
		mouseOrTouchMove(e.pageX, e.pageY, e);
	}

	function touchMove(e) {
		mouseOrTouchMove(e.targetTouches[0].pageX, e.targetTouches[0].pageY, e);
	}

	function mouseUp(e) {
		document.body.onmousemove = null;	// quit listening for mousemove events until next mousedown
		document.body.onmouseup = null;
		mouseOrTouchEnd(e.pageX, e.pageY, e);
 	}

	function touchEnd(e) {
		document.body.ontouchmove = null;	// quit listening for touchmove events until next touchstart
		document.body.ontouchend = null;
		mouseOrTouchEnd(e.changedTouches[0].pageX, e.changedTouches[0].pageY, e);
	}

	// Handle a new mouse click or tap:
	function mouseOrTouchStart(pageX, pageY, e, touch) {
		var canvasX = pageX-theCanvas.offsetLeft-canvasDiv.offsetLeft;
		var canvasY = pageY-theCanvas.offsetTop-canvasDiv.offsetTop;
		if (showNewComponentMenu) {		// click outside of new component menu cancels the new component
			e.preventDefault();
			showNewComponentMenu = false;
			drawingConnection = false;
			newComponentMenu.style.display = "none";
			clickedComponent = -1;
			drawAll();
			return;
		}
		if (showOrientationMenu) {
			e.preventDefault();
			showOrientationMenu = false;
			orientationMenu.style.display = "none";
			showingThetaSlider = false;
			thetaSliderBox.style.display = "none";
			clickedComponent = -1;
			drawAll();	// this shouldn't be needed
			return;
		}
		if (showMagOrientationMenu) {
			e.preventDefault();
			showMagOrientationMenu = false;
			magnetOrientationMenu.style.display = "none";
			clickedComponent = -1;
			drawAll();	// this shouldn't be needed
			return;
		}
		if (showDurationSlider) {		// click outside of duration slider box hides slider
			e.preventDefault();
			showDurationSlider = false;
			durationSliderBox.style.display = "none";
			clickedComponent = -1;
			drawAll();	// this shouldn't be needed
			return;
		}
		if ((canvasX > theCanvas.width-90) && (canvasY > theCanvas.height-40)) {	// tap on Reset button
			// (Notice that the Reset button is activated when a click or tap begins, unlike the buttons
			// on the gun, which are activated when a click or tap ends.  Hope this isn't too confusing.)
			blinkResetButton = true;
			for (var c=0; c<component.length; c++) {
				if (component[c].type == 3) component[c].count = 0;
			}
			counterScale = 100;
			drawAll();
			clickedComponent = -1;
			window.setTimeout(unblinkResetButton, 80);		// undarken the button after 80 ms
			return;
		}
		if ((canvasX < 106) && (canvasY > theCanvas.height-28)) {	// tap on "Coherent" checkbox
			e.preventDefault();		// prevents double-firing of tap event on touch screens
			coherent = !coherent;
			computeProbabilities();
			clickedComponent = -1;
			drawAll();
			return;
		}
		var c = findComponent(canvasX, canvasY);	// see if click is on a component
		if (c > -1) {
			e.preventDefault();
			if (touch) {
				document.body.ontouchmove = touchMove;
				document.body.ontouchend = touchEnd;
			} else {
				document.body.onmousemove = mouseMove;
				document.body.onmouseup = mouseUp;
			}
			movedSinceClick = false;
			clickedComponent = c;
			dragStartX = pageX;
			dragStartY = pageY;
			drawingConnection = false;
			if (component[c].type == 3) return;	// counters can only be dragged so we're done
			var w = componentWidth[component[c].type];
			var h = componentHeight[component[c].type]
			if (canvasX - component[c].x < 0.7*w) return;
			if ((component[c].type == 0) || (component[c].type == 2)) {
				// for the gun or a magnet, make sure click wasn't too high or low:
				if (Math.abs(canvasY - component[c].y - h/2) > h/4) return;
				// and move the horizontal cutoff a little to the right:
				if (canvasX - component[c].x < 0.8*w) return;
				if (component[c].out > 0) component[component[c].out].inCount--;
				component[c].out = 0;	// delete any existing connection
			} else {	// for an analyzer we have to figure out which output was clicked:
				whichOut = Math.floor((canvasY - component[c].y) * dim / h); // should go from 0 to dim-1
				if ((whichOut < 0) || (whichOut >= dim)) console.log("Error: whichOut out of range");
				if (component[c].out[whichOut] > 0) component[component[c].out[whichOut]].inCount--;
				component[c].out[whichOut] = 0;		// delete any existing connection
			}
			drawingConnection = true;
			drawAll();
			computeProbabilities();
		} else {
			clickedComponent = -1;		// not sure if this will matter
		}
	}

	// Function to un-darken the Reset button, called via setTimeout:
	function unblinkResetButton() {
		blinkResetButton = false;
		drawResetButton();
	}

	// Mouse or touch was moved (dragged).  Could be dragging a component or making a new connection.
	function mouseOrTouchMove(pageX, pageY, e) {
		if (clickedComponent > -1) {
			e.preventDefault();
			if (showDurationSlider) return;
			var c = clickedComponent;
			movedSinceClick = true;
			if (drawingConnection) {
				drawAll();	// erases the line drawn to the previous point
				if (component[c].type == 1) {	// if it's an analyzer...
					drawConnectionLine(component[c].x+componentWidth[component[c].type],
							component[c].y+componentHeight[component[c].type]*(whichOut+0.5)/dim,
							pageX-theCanvas.offsetLeft-canvasDiv.offsetLeft,
							pageY-theCanvas.offsetTop-canvasDiv.offsetTop);
				} else {
					drawConnectionLine(component[c].x+componentWidth[component[c].type],
							component[c].y+componentHeight[component[c].type]*0.5,
							pageX-theCanvas.offsetLeft-canvasDiv.offsetLeft,
							pageY-theCanvas.offsetTop-canvasDiv.offsetTop);
				}
			} else {	// otherwise we're dragging a component:
				var dx = pageX - dragStartX;
				var dy = pageY - dragStartY;
				component[c].x += dx;
				component[c].y += dy;
				dragStartX += dx;
				dragStartY += dy;
				if (c == 0) {	// make sure user doesn't drag gun out of bounds
					if (component[0].x < 0) {
						component[0].x = 0;
						dragStartX -= dx;
					}
					if (component[0].x >= theCanvas.width - componentWidth[0]) {
						component[0].x = theCanvas.width - componentWidth[0] - 1;
						dragStartX -= dx;
					}
					if (component[0].y < 0) {
						component[0].y = 0;
						dragStartY -= dy;
					}
					if (component[0].y >= theCanvas.height - componentHeight[0]) {
						component[0].y = theCanvas.height - componentHeight[0] - 1;
						dragStartY -= dy;
					}
				}
				drawAll();
			}
		}
	}

	// Mouse or touch is released:
	function mouseOrTouchEnd(pageX, pageY, e) {
		var canvasX = pageX-theCanvas.offsetLeft-canvasDiv.offsetLeft;
		var canvasY = pageY-theCanvas.offsetTop-canvasDiv.offsetTop
		var dx, dy, r;
		if (drawingConnection) {
			var c = findComponent(canvasX, canvasY);	// returns -1 if no component found, 0 for gun, >0 for others
			// Make the connection if it's not to the gun, or to the component itself, or one that would make a closed loop:
			if ((c > 0) && (c != clickedComponent) && !pointsTo(c,clickedComponent)) {
				if ((component[c].type == 1) || (component[c].inCount == 0)) {	// only analyzers can have more than one path coming in (otherwise logic fails!)
					if (component[clickedComponent].type == 1) {	// if it's an analyzer
						component[clickedComponent].out[whichOut] = c;
					} else {
						component[clickedComponent].out = c;
					}
					component[c].inCount++;
					computeProbabilities();
					clickedComponent = -1;
				}
			}
			// If mouse/touch ends in empty space, show menu to add a new component:
			if ((c == -1) && (canvasX > 0) && (canvasX < theCanvas.width) && (canvasY > 0) && (canvasY < theCanvas.height)) {
				showNewComponentMenu = true;
				newComponentMenu.style.display = "block";
				newComponentMenu.style.left = (canvasX - 40) + "px";
				newComponentMenu.style.top = (canvasY - 40) + "px";	// the 40 is approximate, to roughly center it vertically on the release point
				newComponentX = canvasX;
				newComponentY = canvasY;
			}
			drawingConnection = false;
			drawAll();
		} else if (movedSinceClick) {
			// Dragging out of bounds deletes the component, unless it's the gun:
			if ((canvasX < 0) || (canvasX > theCanvas.width) || (canvasY < 0) || (canvasY > theCanvas.height)) {
				if (clickedComponent > 0) deleteComponent(clickedComponent);
			}
			// (no action needed if this is merely the end of an in-bounds drag)
		} else {	// If we get to here, it's a simple click/tap, not a drag...
			// (Note that these clicks/taps cause an action upon release--not when the click or tap begins.
			// This is because we need to distinguish between a simple click/tap and the start of a drag action.)
			if (clickedComponent == 0) {	// click/tap on gun
				if (canvasY > component[0].y + componentHeight[0]*0.75) {
					var i = Math.floor((canvasX - component[0].x) * 5 / (0.8*componentWidth[0]));
					if ((i >= 0) && (i <= 4)) {
						initialState = i;
						computeProbabilities();
						drawComponent(0);
					}
					clickedComponent = -1;
				} else if (canvasY > component[0].y + componentHeight[0]*0.35) {	// main start/stop button
					running = !running;
					drawComponent(0);
					clickedComponent = -1;
					if (running) runExperiment();
				} else if (canvasX < component[0].x + componentWidth[0]*0.4) {		// "1" button
					blink1button = true;
					drawComponent(0);
					window.setTimeout(unblink1button, 80);	// undarken the button after 80 ms
					sendOneThrough();
					drawCounters();
					clickedComponent = -1;
				} else if (canvasX < component[0].x + componentWidth[0]*0.8) {		// "10k" button
					if (pending <= 0) {		// do nothing if still processing last click
						pending = 10000;
						drawComponent(0);
						sendLotsThrough();
					}
					clickedComponent = -1;
				}
			} else if (component[clickedComponent].type == 1) {		// click/tap on analyzer
				dx = canvasX - (component[clickedComponent].x + componentWidth[1]*0.35);
				dy = canvasY - (component[clickedComponent].y + componentHeight[1]*0.5);
				r = componentHeight[1]/4;	// radius of allowed click/tap area
				if ((dx*dx + dy*dy) < r*r) {
					showOrientationMenu = true;
					orientationMenu.style.left = (component[clickedComponent].x + componentWidth[2]/2 - 70) + "px";
					orientationMenu.style.top = (component[clickedComponent].y + componentHeight[2] - 12)+ "px";
					orientationMenu.style.display = "block";
					if (component[clickedComponent].orientation == 3) showThetaSlider();
					/*component[clickedComponent].orientation++;
					if (component[clickedComponent].orientation >= orientationLetter.length)
						component[clickedComponent].orientation = 0;	// cycle through allowed orientations
					drawComponent(clickedComponent);
					clickedComponent = -1;*/
				} else {
					clickedComponent = -1;
				}
			} else if (component[clickedComponent].type == 2) {		// click/tap on magnet
				dx = canvasX - (component[clickedComponent].x + componentWidth[2]*0.5);
				dy = canvasY - (component[clickedComponent].y + componentHeight[2]*0.35);
				r = componentHeight[2]/4;	// radius of allowed click/tap area
				if ((dx*dx + dy*dy) < r*r) {
					showMagOrientationMenu = true;
					magnetOrientationMenu.style.left = (component[clickedComponent].x + componentWidth[2]/2 - 60) + "px";
					magnetOrientationMenu.style.top = (component[clickedComponent].y + componentHeight[2] - 24)+ "px";
					magnetOrientationMenu.style.display = "block";
					/* component[clickedComponent].orientation++;
					if (component[clickedComponent].orientation >= orientationLetter.length)
						component[clickedComponent].orientation = 0;	// cycle through allowed orientations
					setPropagator(clickedComponent);
					drawComponent(clickedComponent);
					clickedComponent = -1;*/
				} else {
					dy -= componentHeight[2]*0.5;	// new (lower) center for calculating distances
					if ((dx*dx + dy*dy) < r*r) {
						showDurationSlider = true;
						var sBoxWidth = (durationSliderBox.style.width).replace(/\D/g,'');	// trim "px"
						durationSliderBox.style.left = (component[clickedComponent].x + componentWidth[2]/2 - sBoxWidth/2) + "px";
						durationSliderBox.style.top = (component[clickedComponent].y + componentHeight[2]) + "px";
						dSlider.value = component[clickedComponent].count;
						durationSliderBox.style.display = "block";
					} else {
						clickedComponent = -1;
					}
				}
			}
		}
	}

	// Recursive function returns true if output of c1 is connected to c2, directly or indirectly:
	function pointsTo(c1, c2) {
		//debug("Call to pointsTo(" + c1 + ", " + c2 + ")");
		if (component[c1].type == 3) return false;	// counters don't point anywhere
		if (component[c1].type == 1) {		// analyzers have multiple outputs
			var hit = false;	// will be true if we "hit" c2
			for (var o=0; o<component[c1].out.length; o++) {
				if (component[c1].out[o] == 0) {	// output isn't connected to anything
					continue;
				} else if (component[c1].out[o] == c2) {	// output is connected directly to c2
					return true;
				} else {
					hit = hit || pointsTo(component[c1].out[o], c2);	// output is connected to something else
				}
			}
			return hit;
		} else {
			if (component[c1].out == 0) {	// output isn't connected to anything
				return false;
			} else if (component[c1].out == c2) {	// output is connected directly to c2
				return true;
			} else {
				return pointsTo(component[c1].out, c2);	// output is connected to something else
			}
		}
	}

	// Function to find component at location (x,y); returns component index or -1 if none:
	function findComponent(x, y) {
		var foundComponent = -1;
		for (var c=0; c<component.length; c++) {
			var w = componentWidth[component[c].type];
			var h = componentHeight[component[c].type];
			if (pointInRect(x, y, component[c].x, component[c].y, w, h)) {
				foundComponent = c;
				break;
			}
		}
		return foundComponent;
	}

	// Returns true if point (x,y) is inside rectangle (left,top,width,height):
	function pointInRect(x, y, left, top, width, height) {
		return ((x > left) && (x < left+width) && (y > top) && (y < top+height));
	}

	// Create a new component:
	function addComponent(type) {
		var c = component.length;
		if (type == 1) {
			component[c] = {type:1, orientation:0, angle:45, out:[]};
			setEigenvectors(c);
			for (var o=0; o<dim; o++) component[c].out[o] = 0;
		} else if (type == 2) {
			component[c] = {type:2, orientation:2, count:18, out:0};
			setPropagator(c);
		} else if (type == 3) {
			component[c] = {type:3, count:0};
		}
		component[c].x = newComponentX;
		component[c].y = newComponentY - componentHeight[component[c].type]/2;
		showNewComponentMenu = false;
		newComponentMenu.style.display = "none";
		if (component[clickedComponent].type == 1) {	// if it's an analyzer
			component[clickedComponent].out[whichOut] = c;
		} else {
			component[clickedComponent].out = c;
		}
		component[c].inCount = 1;
		computeProbabilities();
		clickedComponent = -1;
		drawAll();
	}

	// Delete the component with index c:
	function deleteComponent(c) {
		// First decrement inCount for any components that this one feeds into:
		if (component[c].type == 1) {
			for (var o=0; o<component[c].out.length; o++) {
				if (component[c].out[o] > 0) component[component[c].out[o]].inCount--;
			}
		} else {
			if (component[c].out > 0) component[component[c].out].inCount--;
		}
		// Remove component c from the array:
		component.splice(c, 1);
		// Now loop through remaining components and update connections:
		for (var cc=0; cc<component.length; cc++) {
			if (component[cc].type == 1) {		// if it's an analyzer...
				for (var o=0; o<component[cc].out.length; o++) {
					if (component[cc].out[o] == c) component[cc].out[o] = 0;
					if (component[cc].out[o] > c) component[cc].out[o]--;
				}
			} else {	// I guess counters have out=null, but that's ok
				if (component[cc].out == c) component[cc].out = 0;
				if (component[cc].out > c) component[cc].out--;
			}
		}
		computeProbabilities();
		drawAll();
	}

	// Set the orientation of an analyzer or magnet:
	function setOrientation(i) {
		component[clickedComponent].orientation = i;
		if (component[clickedComponent].type == 1) setEigenvectors(clickedComponent);
		if (component[clickedComponent].type == 2) setPropagator(clickedComponent);
		orientationMenu.style.display = "none";
		showOrientationMenu = false;
		magnetOrientationMenu.style.display = "none";
		showMagOrientationMenu = false;
		thetaSliderBox.style.display = "none";
		showingThetaSlider = false;
		clickedComponent = -1;
		computeProbabilities();
		drawAll();
	}

	// Show the theta slider (for analyzers only, when theta is clicked in the orientation menu):
	function showThetaSlider() {
		component[clickedComponent].orientation = 3;
		setEigenvectors(clickedComponent);
		thetaSlider.value = component[clickedComponent].angle + "";
		thetaSliderBox.style.left = (Number((orientationMenu.style.left).replace(/\D/g,'')) - 25) + "px";
		thetaSliderBox.style.top = (Number((orientationMenu.style.top).replace(/\D/g,'')) + 36) + "px";
		thetaSliderBox.style.display = "block";
		showingThetaSlider = true;
		drawAll();
		computeProbabilities();
	}

	// Set the value of theta (as the theta slider is moved):
	function setTheta() {
		component[clickedComponent].angle = Number(thetaSlider.value);
		setEigenvectors(clickedComponent);
		computeProbabilities();
		drawAll();
	}

	// Set the duration on a magnet:
	function setDuration() {
		component[clickedComponent].count = Number(dSlider.value);
		setPropagator(clickedComponent);
		computeProbabilities();
		drawComponent(clickedComponent);
		//drawAll();	// this is needed only for debugging
	}

	// Function to un-darken the "1" button, called via setTimeout so user sees a "blink":
	function unblink1button() {
		blink1button = false;
		drawComponent(0);
	}

	// Switch the dimension between 2 and 3, and re-initialize the setup:
	function changeDim() {
		if (dim == 2) {
			dim = 3;
			arrows = false;
		} else {
			dim = 2;
			arrows = true;
		}
		init();
	}

	// ********** Drawing code ***********

	// Function to redraw the whole laboratory:
	function drawAll() {
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0,0,theCanvas.width,theCanvas.height);
		for (var c=0; c<component.length; c++) {
			drawComponent(c);
		}
		for (var c=0; c<component.length; c++) {
			drawConnections(c);
		}
		drawResetButton();
		drawCoherentCheck();
		if (showNewComponentMenu) {
			ctx.fillStyle = "rgba(0,0,0,0.35)";		// black with 35% opacity, to gray-out everything
			ctx.fillRect(0,0,theCanvas.width,theCanvas.height);
		}
	}

	// Draw the Reset button:
	function drawResetButton() {
		if (blinkResetButton) {
			ctx.fillStyle = resetButtonBlinkColor;
		} else {
			ctx.fillStyle = counterEmptyColor;
		}
		ctx.strokeStyle = outlineColor;
		ctx.lineWidth = 1;
		roundRect(ctx, theCanvas.width-86, theCanvas.height-36, 80, 30, 10, true, true);
		ctx.fillStyle = textColor;
		ctx.textAlign = "center";
		ctx.font = "20px sans-serif";
		ctx.fillText("Reset", theCanvas.width-46, theCanvas.height-14);
	}

	// Draw the "Coherent" checkbox (only when it will have an effect on the results):
	function drawCoherentCheck() {
		var matters = false;		// will be true if coherence matters
		for (var c=1; c<component.length; c++) {
			if (component[c].inCount > 1) {			// if this component has more than one path coming in...
				matters = true;
				continue;
			}
		}
		if (matters) {
			ctx.strokeStyle = lightOutlineColor;
			ctx.lineWidth = 1;
			ctx.strokeRect(8, theCanvas.height-24, 16, 16);
			if (coherent) {
				ctx.strokeStyle = textColor;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(10, theCanvas.height-17);
				ctx.lineTo(14, theCanvas.height-12);
				ctx.lineTo(23, theCanvas.height-22);
				ctx.stroke();
			}
			ctx.font = "18px sans-serif";
			ctx.fillStyle = textColor;
			ctx.textAlign = "left";
			ctx.fillText("Coherent", 29, theCanvas.height-10);
		}
	}

	// Function to draw all the counters:
	function drawCounters() {
		for (var c=0; c<component.length; c++) {
			if (component[c].type == 3) drawComponent(c);
		}
	}

	// Function to draw component c:
	function drawComponent(c) {
		var comp = component[c];
		var w = componentWidth[comp.type];
		var h = componentHeight[comp.type];
		if (comp.type == 3) {	// counter
			ctx.fillStyle = counterEmptyColor;
			ctx.fillRect(comp.x, comp.y, w, h);							// background
			ctx.fillStyle = counterFullColor;
			var filledWidth = w * comp.count / counterScale;
			var emptyWidth = w - filledWidth;
			ctx.fillRect(comp.x + emptyWidth, comp.y, filledWidth, h);	// filled portion
			ctx.strokeStyle = outlineColor;
			ctx.lineWidth = 1;
			ctx.strokeRect(comp.x, comp.y, w, h);						// outline
			var countDigits = comp.count.toString().length;
			ctx.fillStyle = backgroundColor;
			ctx.fillRect(comp.x+w-countDigits*12, comp.y+h+3, countDigits*12+1, 21);	// erase old number
			ctx.fillStyle = textColor;
			ctx.font = "20px sans-serif";
			ctx.textAlign = "right";
			ctx.fillText(comp.count, comp.x+w, comp.y+h+21);
			// Temporary code for debugging:
			//ctx.fillStyle = backgroundColor;
			//ctx.fillRect(comp.x, comp.y+h+3, 60, 21);	// erase old number
			//ctx.fillStyle = textColor;
			//var prob = cSquareMod(comp.amp);
			//ctx.textAlign = "left";
			//ctx.fillText(prob.toFixed(3), comp.x, comp.y+h+21);
		} else if (comp.type == 1) {	// analyzer
			ctx.fillStyle = analyzerColor;
			ctx.strokeStyle = outlineColor;
			ctx.lineWidth = 1;
			ctx.beginPath();								// trapezoidal main body
			ctx.moveTo(comp.x+w*0.7, comp.y);
			ctx.lineTo(comp.x+w*0.7, comp.y+h);
			ctx.lineTo(comp.x, comp.y+h*0.8);
			ctx.lineTo(comp.x, comp.y+h*0.2);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			if (dim == 2) {									// output orifices
				ctx.beginPath();
				ctx.moveTo(comp.x+w*0.7, comp.y+h*0.04);
				ctx.lineTo(comp.x+w, comp.y+h*0.04);
				ctx.lineTo(comp.x+w, comp.y+h*0.46);
				ctx.lineTo(comp.x+w*0.7, comp.y+h*0.46);
				ctx.lineTo(comp.x+w*0.7, comp.y+h*0.54);
				ctx.lineTo(comp.x+w, comp.y+h*0.54);
				ctx.lineTo(comp.x+w, comp.y+h*0.96);
				ctx.lineTo(comp.x+w*0.7, comp.y+h*0.96);
				ctx.closePath();
				ctx.fill();
				ctx.stroke();
				ctx.lineWidth = 2;
				if (arrows) {
					drawArrow(ctx, comp.x+w*0.85, comp.y+h*0.38, comp.y+h*0.12, w*0.14, textColor);
					drawArrow(ctx, comp.x+w*0.85, comp.y+h*0.62, comp.y+h*0.88, w*0.14, textColor);
				} else {
					var hh = h / 6;
					drawSegment(ctx, comp.x+w*0.85, comp.y+h*0.25-hh/2, comp.x+w*0.85, comp.y+h*0.25+hh/2);
					drawSegment(ctx, comp.x+w*0.85-hh/2, comp.y+h*0.25, comp.x+w*0.85+hh/2, comp.y+h*0.25);
					drawSegment(ctx, comp.x+w*0.85-hh/2, comp.y+h*0.75, comp.x+w*0.85+hh/2, comp.y+h*0.75);
				}
			} else {	// dim == 3...
				ctx.beginPath();
				ctx.moveTo(comp.x+w*0.7, comp.y+h*0.03);
				ctx.lineTo(comp.x+w, comp.y+h*0.03);
				ctx.lineTo(comp.x+w, comp.y+h*0.31);
				ctx.lineTo(comp.x+w*0.7, comp.y+h*0.31);
				ctx.lineTo(comp.x+w*0.7, comp.y+h*0.36);
				ctx.lineTo(comp.x+w, comp.y+h*0.36);
				ctx.lineTo(comp.x+w, comp.y+h*0.64);
				ctx.lineTo(comp.x+w*0.7, comp.y+h*0.64);
				ctx.lineTo(comp.x+w*0.7, comp.y+h*0.69);
				ctx.lineTo(comp.x+w, comp.y+h*0.69);
				ctx.lineTo(comp.x+w, comp.y+h*0.97);
				ctx.lineTo(comp.x+w*0.7, comp.y+h*0.97);
				ctx.closePath();
				ctx.fill();
				ctx.stroke();
				ctx.lineWidth = 2;
				roundRect(ctx, comp.x+w*0.79, comp.y+h*0.42, w*0.12, h*0.16, w*0.06, true, true);
				if (arrows) {
					drawArrow(ctx, comp.x+w*0.85, comp.y+h*0.27, comp.y+h*0.075, w*0.14, textColor);
					drawArrow(ctx, comp.x+w*0.85, comp.y+h*0.73, comp.y+h*0.925, w*0.14, textColor);
				} else {
					var hh = h / 6;
					drawSegment(ctx, comp.x+w*0.85, comp.y+h*0.17-hh/2, comp.x+w*0.85, comp.y+h*0.17+hh/2);
					drawSegment(ctx, comp.x+w*0.85-hh/2, comp.y+h*0.17, comp.x+w*0.85+hh/2, comp.y+h*0.17);
					drawSegment(ctx, comp.x+w*0.85-hh/2, comp.y+h*0.83, comp.x+w*0.85+hh/2, comp.y+h*0.83);
				}
			}
			ctx.fillStyle = textColor;
			ctx.font = "36px sans-serif";
			ctx.textAlign = "center";
			if (comp.orientation < 3) {		// if it's a regular xyz orientation...
				ctx.font = "36px sans-serif";
				ctx.fillText(orientationLetter[comp.orientation], comp.x+w*0.35, comp.y+h*0.5+14);
			} else {	// otherwise it's an adjustable angle so write the angle in degrees
				ctx.font = "22px sans-serif";
				ctx.fillText(comp.angle + '\xB0', comp.x+w*0.35, comp.y+h*0.5+8);	// \xB0 is degree symbol
			}
		} else if (comp.type == 2) {	// magnet
			ctx.fillStyle = magnetColor;
			ctx.strokeStyle = outlineColor;
			ctx.lineWidth = 1;
			ctx.fillRect(comp.x, comp.y+h*0.25, w, h*0.5);
			ctx.strokeRect(comp.x, comp.y+h*0.25, w, h*0.5);
			roundRect(ctx, comp.x+w*0.2, comp.y, w*0.6, h, w*0.2, true, true);
			ctx.fillStyle = textColor;
			ctx.font = "36px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(orientationLetter[comp.orientation], comp.x+w*0.5, comp.y+h*0.5+2);
			ctx.font = "20px sans-serif";
			ctx.fillText(comp.count, comp.x+w*0.5, comp.y+h-9);	// should add leading zero(s) so it's always 2 digits
		} else {	// gun...
			ctx.fillStyle = gunColor;
			ctx.strokeStyle = outlineColor;
			ctx.lineWidth = 1;
			// Output protrusion:
			ctx.fillRect(comp.x+w*0.8, comp.y+h*0.3, w*0.2, h*0.4);
			ctx.beginPath();
			ctx.moveTo(comp.x+w*0.8, comp.y+h*0.3);
			ctx.lineTo(comp.x+w, comp.y+h*0.3);
			ctx.moveTo(comp.x+w*0.8, comp.y+h*0.7);
			ctx.lineTo(comp.x+w, comp.y+h*0.7);
			ctx.stroke();
			//ctx.strokeRect(comp.x+w*0.8, comp.y+h*0.3, w*0.2, h*0.4);
			for (var i=1; i<=4; i++) {
				ctx.beginPath();
				ctx.moveTo(comp.x+w*(0.8+i*0.05), comp.y+h*0.3);
				ctx.lineTo(comp.x+w*(0.8+i*0.05), comp.y+h*0.44);
				ctx.moveTo(comp.x+w*(0.8+i*0.05), comp.y+h*0.56);
				ctx.lineTo(comp.x+w*(0.8+i*0.05), comp.y+h*0.7);
				ctx.stroke();
			}
			ctx.strokeStyle = pathColor;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(comp.x+w*0.8, comp.y+h*0.5);
			ctx.lineTo(comp.x+w, comp.y+h*0.5);
			ctx.stroke();
			// Main body:
			ctx.strokeStyle = outlineColor;
			ctx.lineWidth = 1;
			ctx.fillRect(comp.x, comp.y, w*0.8, h);
			ctx.strokeRect(comp.x, comp.y, w*0.8, h);
			// Buttons:
			ctx.fillStyle = startButtonColor;
			if (running) ctx.fillStyle = stopButtonColor;
			roundRect(ctx, comp.x+w*0.1, comp.y+h*0.38, w*0.6, h*0.3, w*0.1, true, true);	// Start button
			if (blink1button) {
				ctx.fillStyle = smallButtonBlinkColor;		// darken the button if it was just pressed
			} else {
				ctx.fillStyle = smallButtonColor;
			}
			roundRect(ctx, comp.x+w*0.04, comp.y+h*0.06, w*0.34, h*0.25, w*0.08, true, true);	// 1 button
			if (pending > 0) {
				ctx.fillStyle = smallButtonBlinkColor;		// darken the button if still running
			} else {
				ctx.fillStyle = smallButtonColor;
			}
			roundRect(ctx, comp.x+w*0.42, comp.y+h*0.06, w*0.34, h*0.25, w*0.08, true, true);	// 10k button
			ctx.font = "20px sans-serif";
			ctx.fillStyle = textColor;
			ctx.textAlign = "center";
			var label = "Start";
			if (running) label = "Stop";
			ctx.fillText(label, comp.x+w*0.4, comp.y+h*0.6);
			ctx.font = "16px sans-serif";
			ctx.fillText("1", comp.x+w*0.21, comp.y+h*0.24);
			ctx.fillText("10k", comp.x+w*0.59, comp.y+h*0.24);
			// Initial state settings:
			ctx.fillStyle = textColor;
			ctx.font = "18px sans-serif";
			ctx.textAlign = "center";
			var iChar = ["R", "1", "2", "3", "4"];
			for (var i=0; i<5; i++) {
				ctx.fillText(iChar[i], comp.x+(2*i+1)*w*0.8/10, comp.y+h-7);
			}
			ctx.fillRect(comp.x+initialState*w*0.8/5, comp.y+h*0.75, w*0.8/5, h*0.25);
			ctx.fillStyle = gunColor;
			ctx.fillText(iChar[initialState], comp.x+(2*initialState+1)*w*0.8/10, comp.y+h-7);
		}
	}	// end of drawComponent

	// Function to draw the lines connecting outputs of component c to whatever is downstream:
	function drawConnections(c) {
		var cNext;	// index of the component we're connecting to
		if (component[c].type == 3) return;		// Counters don't have outputs
		var w = componentWidth[component[c].type];
		var h = componentHeight[component[c].type];
		// Analyzers are the most complicated, with multiple outputs:
		if (component[c].type == 1) {	// analyzer
			for (var o=0; o<dim; o++) {
				cNext = component[c].out[o];
				if (cNext > 0) {
					drawConnectionLine(component[c].x+w, component[c].y+h*(o+0.5)/dim,
						component[cNext].x, component[cNext].y+componentHeight[component[cNext].type]/2);
				}
			}
		}
		// Otherwise it's the gun or a magnet, and it has exactly one output, centered vertically:
		cNext = component[c].out;
		if (cNext > 0) {
			drawConnectionLine(component[c].x+w, component[c].y+h/2,
				component[cNext].x, component[cNext].y+componentHeight[component[cNext].type]/2);
		}
	}

	// Draw a connection line between two points, given in canvas coordinates:
	function drawConnectionLine(x1, y1, x2, y2) {
		ctx.strokeStyle = pathColor;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}

	// Draw a vertical arrow from y1 to y2:
	function drawArrow(ctx, x, y1, y2, width, color) {
		var direction = (y2 - y1) / Math.abs(y2 - y1);	// 1 or -1
		var headLength = Math.min(width, Math.abs(y2-y1)*0.55);
		ctx.lineWidth = 2;
		ctx.strokeStyle = color;
		drawSegment(ctx, x, y1, x, y2-direction*headLength/2);	// stop short of tip
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(x, y2);
		ctx.lineTo(x-width/2, y2-direction*headLength);
		ctx.lineTo(x+width/2, y2-direction*headLength);
		ctx.closePath();
		ctx.fill();
	}

	// Draw a single line segment from (x1, y1) to (x2, y2):
	function drawSegment(ctx, x1, y1, x2, y2) {
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}

	/**
	 * Rounded rectangle function by Juan Mendes,
	 * http://js-bits.blogspot.com/2010/07/canvas-rounded-corner-rectangles.html
	 * Draws a rounded rectangle using the current state of the canvas.
	 * If you omit the last three params, it will draw a rectangle
	 * outline with a 5 pixel border radius
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {Number} x The top left x coordinate
	 * @param {Number} y The top left y coordinate
	 * @param {Number} width The width of the rectangle
	 * @param {Number} height The height of the rectangle
	 * @param {Number} radius The corner radius. Defaults to 5;
	 * @param {Boolean} fill Whether to fill the rectangle. Defaults to false.
	 * @param {Boolean} stroke Whether to stroke the rectangle. Defaults to true.
	 */
	function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
		if (typeof stroke == "undefined" ) {
			stroke = true;
		}
		if (typeof radius === "undefined") {
			radius = 5;
		}
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
		if (fill) {
			ctx.fill();
		}
		if (stroke) {
			ctx.stroke();
		}
	}
