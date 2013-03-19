/**
 * Tracking compiler state.
 * @TODO Comments all over.
 * @param {String} body
 */
edb.Status = function Status ( body ) {
	this.body = body || "";
	this.conf = [];
};

edb.Status.prototype = {
	mode : edb.Status.MODE_JS,
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

edb.Status.MODE_JS = "js";
edb.Status.MODE_HTML = "html";
edb.Status.MODE_TAG = "tag";