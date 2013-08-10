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
	 * Output Type instance in context. @TODO: some complicated argument combos to explain here
	 * @param {Window|WorkerGlobalScope|IInputHandler} context @TODO input handler!
	 * @param {Object|Array|edb.Object|edb.Array} data Raw JSON or Type instance
	 * @param @optional {function|string} Type Optional edb.Type constructor
	 * @returns {edb.Object|edb.Array}
	 */
	dispatch : function ( type, context ) {
		context = context || self;
		this._configure ( type.constructor, type, context );
		gui.Broadcast.dispatch ( 
			null, 
			edb.BROADCAST_OUTPUT, 
			new edb.Input ( type ), 
			context.gui.$contextid 
		);
		gui.Broadcast.addGlobal ( gui.BROADCAST_WILL_UNLOAD, this );
	},

	/**
	 * Instance of given Type has been output to context?
	 * @param {function} type Type constructor
	 * @param {Window|WorkerGlobalScope} context
	 * @returns {boolean}
	 */
	out : function ( Type, context ) {
		context = context || self;
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
	 * Mapping contextid to map mapping Type classname to Type instance.
	 * @type {Map<String,Map<String,edb.Object|edb.Array>>}
	 */
	_contexts : {},

	/**
	 * Configure Type instance for output.
	 * @param {function} Type constructor
	 * @param {edb.Object|edb.Array} type instance
	 * @param {Window|WorkerGlobalScope} context
	 */
	_configure : function ( Type, type, context ) {
		var contxid = context.gui.$contextid;
		var contmap = this._contexts [ contxid ] || ( this._contexts [ contxid ] = {});
		var classid = Type.$classid;
		contmap [ classid ] = type;
		type.$context = context;
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
	 * @param {Window|WorkerGlobalScope} context
	 * @param {function} Type
	 * @returns {edb.Input}
	 */
	$get : function ( Type, context ) {
		context = context || self;
		if ( Type.out ( context )) {
			var contxid = context.gui.$contextid;
			var contmap = this._contexts [ contxid ];
			var classid = Type.$classid;
			var typeobj = contmap [ classid ];
			return new edb.Input ( typeobj );
		}
		return null;
	}

};