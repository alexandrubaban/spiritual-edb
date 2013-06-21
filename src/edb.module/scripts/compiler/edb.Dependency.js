/**
 * Tracking a single function dependency.
 * @param {Window} context
 * @param {String} type
 * @param {String} name
 * @param {String} href
 */
edb.Dependency = function ( context, type, name, href ) {
	this.href = gui.URL.absolute ( context.document, href );
	this.type = type;
	this.name = name;
	this._context = context;
	this._document = context.document;
};

edb.Dependency.prototype = {

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
	 * Resolve dependency.
	 */
	resolve : function () {
		var pool = this._functionpool ();
		var func = pool.get ( this._context, this.href );
		var then = new gui.Then ();
		if ( func ) {
			then.now ( func );
		} else {
			pool.load ( this._context, this._document, this.href, function onreadystatechange ( func ) {
				if ( func.readyState === edb.Template.READY ) {
					then.now ( func );
				}
			});
		}
		return then;
	},

	/**
	 * Where to lookup compiled functions?
	 * @returns {function}
	 */
	_functionpool : function () {
		switch ( this.type ) {
			case edb.Dependency.TYPE_FUNCTION :
				return edb.Function;
			case edb.Dependency.TYPE_TAG :
				return edb.Tag;
		}
	},


	// Private .......................................

	/**
	 * Context to compile into.
	 * @type {Window|WebWorkerGlobalScope}
	 */
	_context : null

};

/**
 * Function dependency.
 * @type {String}
 */
edb.Dependency.TYPE_FUNCTION = "function";

/**
 * Tag dependency.
 * @type {String}
 */
edb.Dependency.TYPE_TAG = "tag";