/**
 * Output the inputs.
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
	 * Output data in context. @TODO: some complicated argument combos to explain here
	 * @param {Window|WorkerScope} context
	 * @param {Object|Array|edb.Object|edb.Array} data Raw JSON or Type instance
	 * @param @optional {function|string} Type Optional edb.Type constructor
	 * @returns {edb.Object|edb.Array}
	 */
	dispatch : function ( context, data, Type ) {
		var input = edb.Input.format ( context, data, Type );
		this._configure ( context, input.data, input.type );
		gui.Broadcast.dispatch ( null, edb.BROADCAST_OUTPUT, input, context.gui.$contextid );
		gui.Broadcast.addGlobal ( gui.BROADCAST_WILL_UNLOAD, this );
	},

	/**
	 * Type has been output in context?
	 * @returns {boolean}
	 */
	exists : function ( context, Type ) {
		var contxid = context.gui.$contextid;
		var contmap = this._contexts [ contxid ];
		var classid = Type.$classid;
		return contmap && contmap [ classid ];
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} b
	 */
	onbroadcast : function ( b ) {
		if ( b.type === gui.BROADCAST_WILL_UNLOAD ) {
			this._onunload ( b.data );
		}
	},


	// Private ............................................................................

	/**
	 * Mapping contxid to map mapping Type classid to Type instance.
	 * @type {Map<String,Map<String,edb.Object|edb.Array>>}
	 */
	_contexts : {},

	/**
	 * Configure instance for output.
	 * @param {edb.Input} input
	 * @param {edb.Object|edb.Array} type Instance
	 */
	_configure : function ( context, type, Type ) {
		var contxid = context.gui.$contextid;
		var contmap = this._contexts [ contxid ] || ( this._contexts [ contxid ] = {});
		var classid = Type.$classid;
		contmap [ classid ] = type;
		type.$contextid = contxid;
	},

	/**
	 * Stop tracking output for expired context.
	 * @param {String} contextid
	 */
	_onunload : function ( contextid ) {
		var context = this._contexts [ contextid ];
		if ( context ) {
			gui.Object.each ( context, function ( classid, type ) {
				type.$ondestruct ();
			}, this );
			delete this._contexts [ contextid ];
		}
	},


	// Secrets .................................................................

	/**
	 * Get output of type in given context. Note that this returns an edb.Input. 
	 * @TODO Officially this should be supported via methods "add" and "remove".
	 * @param {Window|WorkerScope} context
	 * @param {function} Type
	 * @returns {edb.Input}
	 */
	$get : function ( context, Type ) {
		if ( this.exists ( context, Type )) {
			var contxid = context.gui.$contextid;
			var contmap = this._contexts [ contxid ];
			var classid = Type.$classid;
			var typeobj = contmap [ classid ];
			return edb.Input.format ( context, typeobj );
		}
		return null;
	}

};