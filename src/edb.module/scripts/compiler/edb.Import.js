/**
 * Tracking a single function import (dependency).
 * @param {Window} context Compiler target context
 * @param {Document} basedoc Resolving relative URLs
 * @param {String} type
 * @param {String} href Note: might be relative!
 * @param {String} name
 *
 * https://gist.github.com/johan/3915545
 */
edb.Import = function ( context, basedoc, type, href, name ) {
	this._context = context;
	this._document = basedoc;
	this.type = type;
	this.name = name;
	this.href = href;
};

edb.Import.prototype = {

	/**
	 * Matches function|tag
	 * @type {String}
	 */
	type : null,

	/**
	 * Runtime name (variable name).
	 * @type {String}
	 */
	name : null,

	/**
	 * Dependency address.
	 * @type {String}
	 */
	href : null,

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Import]";
	},

	/**
	 * Resolve dependency.
	 */
	resolve : function () {
		var pool = this._functionpool ();
		var func = pool.get ( this._context, this.tempname ());
		var then = new gui.Then ();
		if ( func ) {
			then.now ( func );
		} else {
			pool.load ( this._context, this._document, this.href, function onreadystatechange ( func ) {
				if ( func.readyState === edb.Function.READY ) {
					then.now ( func );
				}
			});
		}
		return then;
	},

	/**
	 * Hm.
	 * @returns {String}
	 */
	tempname : function () {
		return new gui.URL ( this._document, this.href ).href;
	},

	/**
	 * Where to lookup compiled functions?
	 * @returns {function}
	 */
	_functionpool : function () {
		switch ( this.type ) {
			case edb.Import.TYPE_FUNCTION :
				return edb.Function;
			case edb.Import.TYPE_TAG :
				return edb.Tag;
		}
	},


	// Private .......................................

	/**
	 * Context to compile into.
	 * @type {Window|WebWorkerGlobalScope}
	 */
	_context : null,

	/**
	 * Base for relative URLs.
	 * @type {Document}
	 */
	_document : null

};

/**
 * Function dependency.
 * @type {String}
 */
edb.Import.TYPE_FUNCTION = "function";

/**
 * Tag dependency.
 * @type {String}
 */
edb.Import.TYPE_TAG = "tag";