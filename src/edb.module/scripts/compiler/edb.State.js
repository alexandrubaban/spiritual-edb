/**
 * Tracking compiler state.
 */
edb.State = function () {
	this.conf = [];
};

edb.State.prototype = {
	mode : edb.State.MODE_JS,
	body : '"use strict";\n',
	peek : false,
	poke : false,
	cont : false,
	adds : false,
	func : null,
	conf : null,
	skip : 0,
	last : 0,
	spot : 0,
	indx : 0
}


// Static ..........................

edb.State.MODE_JS = "js";
edb.State.MODE_HTML = "html";
edb.State.MODE_TAG = "tag";