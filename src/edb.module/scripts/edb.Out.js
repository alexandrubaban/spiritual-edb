/**
 * Collects HTML output during EDBML rendering phase.
 * Any methods added to this prototype will become 
 * available in EDBML scripts as: out.mymethod()
 */
edb.Out = function Out () {

	this.html = "";
};

edb.Out.prototype = {

	/**
	 * HTML string (not well-formed while parsing).
	 * @type {String}
	 */
	html : null,

	/**
	 * Get HTML result. Do your output modification here.
	 * @returns {String}
	 */
	toString : function () {

		return this.html;
	}
};