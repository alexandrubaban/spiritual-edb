/**
 * Tracking compiler state.
 */
edb.CompileState = function () {
	this.conf = [];
};

edb.CompileState.prototype = {
	mode : edb.CompileState.MODE_JS,
	body : '"use strict";\n',
	html : false,
	peek : false,
	poke : false,
	cont : false,
	adds : false,
	tagt : false,
	func : null,
	conf : null,
	skip : 0,
	last : 0,
	spot : 0,
	indx : 0
}

edb.CompileState.MODE_JS = 0;
edb.CompileState.MODE_HTML = 1;
edb.CompileState.MODE_TAG = 2;