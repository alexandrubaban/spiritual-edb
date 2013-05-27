/**
 * Tracking a single function dependency.
 * @param {Window} context @TODO: use signature instead...
 * @param {String} type
 * @param {String} name
 * @param {String} href
 */
edb.Dependency = function ( context, type, name, href ) {
	this.href = gui.URL.absolute ( context.document, href );
	this.type = type;
	this.name = name;
	this._context = context;
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
	 * Dependency URL location.
	 * @type {String}
	 */
	href : null,

	/**
	 * @param {Window} context
	 */
	resolve : function () {
		var res = this._source ().get ( this._context, this.href );
		var then = this._then = new gui.Then ();
		if ( res ) {
			then.now ( res );
		} else {
			gui.Broadcast.add ( 
				edb.BROADCAST_FUNCTION_LOADED, 
				this, this._context.gui.signature 
			);
		}
		return then;
	},

	/**
	 * Handle broadcast.
	 * @param  {[type]} b [description]
	 * @return {[type]}   [description]
	 */
	onbroadcast : function ( b ) {
		switch ( b.type ) {
			case edb.BROADCAST_FUNCTION_LOADED :
				if ( b.data === this.href ) {
					this._then.now ( this._source ().get ( this._context, this.href ));
					gui.Broadcast.remove ( b.type, this, b.signature );
					this._context = null;
					this._then = null;
				}
				break;
		}
	},

	/**
	 * Compute relevant function repository.
	 * @returns {function}
	 */
	_source : function () {
		switch ( this.type ) {
			case edb.Dependency.TYPE_FUNCTION :
				return edb.Function;
				break;
			case edb.Dependency.TYPE_TAG :
				return edb.Tag;
				break;
		}
	},


	// Private .......................................

	/**
	 * @TODO: use signature instead...
	 * @type {Window}
	 */
	_context : null,

	/**
	 * @type {gui.Then}
	 */
	_then : null
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