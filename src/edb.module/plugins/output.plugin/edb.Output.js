/**
 * Output all the inputs.
 * @TODO add and remove methods.
 */
edb.Output = {
	
	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Output]";
	},

	/**
	 * Output Type instance.
	 * @returns {edb.Object|edb.Array}
	 */
	dispatch : function ( type ) {
		var input = this._configure ( type.constructor, type );
		gui.Broadcast.dispatch ( null, edb.BROADCAST_OUTPUT, input );
	},

	/**
	 * Instance of given Type has been output to context?
	 * @param {function} type Type constructor
	 * @returns {boolean}
	 */
	out : function ( Type ) {
		var classid = Type.$classid;
		var typeobj = this._map [ classid ];
		return typeobj ? true : false;
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} b
	 */
	onbroadcast : function ( b ) {
		if ( b.type === gui.BROADCAST_WILL_UNLOAD ) {
			this._onunload ();
		}
	},


	// Private ............................................................................
	
	/**
	 * Mapping Type classname to Type instance.
	 * @type {Map<String,edb.Object|edb.Array>}
	 */
	_map : {},

	/**
	 * Configure Type instance for output.
	 * @param {function} Type constructor
	 * @param {edb.Object|edb.Array} type instance
	 * @returns {edb.Input}
	 */
	_configure : function ( Type, type ) {
		var classid = Type.$classid;
		this._map [ classid ] = type;
		return new edb.Input ( type );
	},

	/**
	 * Stop tracking output for expired context.
	 * @param {String} contextid
	 */
	_onunload : function () {
		gui.Object.each ( this._map, function ( classid, type ) {
			type.$ondestruct ();
		});
		this._map = null;
	},


	// Secrets .................................................................

	/**
	 * Get output of given type. Note that this returns an edb.Input. 
	 * @TODO Officially this should be supported via methods "add" and "remove".
	 * @param {function} Type
	 * @returns {edb.Input}
	 */
	$get : function ( Type, context ) {
		var classid = Type.$classid;
		var typeobj = this._map [ classid ];
		return typeobj ? new edb.Input ( typeobj ) : null;
	}

};