/**
 * Tracking compiler state.
 * @todo Comments all over.
 * @param {String} body
 */
edb.State = function ( body ) {
	this.body = body || "";
	this.conf = [];
};

edb.State.prototype = {
	mode : edb.State.MODE_JS,
	body : null,
	peek : false,
	poke : false,
	cont : false,
	adds : false,
	func : null,
	conf : null,
	skip : 0,
	last : 0,
	spot : 0,
	indx : 0,

	// tags
	refs : false // pass by reference in tags
};


// Static ..........................

edb.State.MODE_JS = "js";
edb.State.MODE_HTML = "html";
edb.State.MODE_TAG = "tag";