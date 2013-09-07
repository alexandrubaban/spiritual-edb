/**
 * Stateful compiler stuff.
 * @param {String} body
 */
edb.Status = function Status () {
	this.conf = [];
};

// Static ....................................................

edb.Status.MODE_JS = "js";
edb.Status.MODE_HTML = "html";
edb.Status.MODE_TAG = "tag";

// Instance ..................................................

edb.Status.prototype = {
	mode : edb.Status.MODE_JS,
	peek : false,
	poke : false,
	cont : false,
	adds : false,
	func : null,
	conf : null,
	curl : null,
	skip : 0,
	last : 0,
	spot : 0,
	indx : 0,

	// tags
	refs : false, // pass by reference in tags

	/**
	 * Is JS mode?
	 * @returns {boolean}
	 */
	isjs : function () {
		return this.mode === edb.Status.MODE_JS;
	},

	/**
	 * Is HTML mode?
	 * @returns {boolean}
	 */
	ishtml : function () {
		return this.mode === edb.Status.MODE_HTML;
	},

	/**
	 * Is tag mode?
	 * @returns {boolean}
	 */
	istag : function () {
		return this.mode === edb.Status.MODE_TAG;
	},

	/**
	 * Go JS mode.
	 */
	gojs : function () {
		this.mode = edb.Status.MODE_JS;
	},

	/**
	 * Go HTML mode.
	 */
	gohtml : function () {
		this.mode = edb.Status.MODE_HTML;
	},

	/**
	 * Go tag mode.
	 */
	gotag : function () {
		this.mode = edb.Status.MODE_TAG;
	}
};