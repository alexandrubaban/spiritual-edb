/**
 * Output input.
 * @TODO: Don't broadcast global!
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
	 * @param {Window|WorkerGlobalScope} context
	 * @param {object|array|edb.Type} data
	 * @param @optional {function|string} Type
	 * @returns {edb.Object|edb.Array}
	 */
	dispatch : function ( context, data, Type ) {
		var type, input = edb.Input.format ( context, data, Type );
		Type = input.type;
		type = input.data;
		type.$contextid = context.gui.$contextid;
		Type.output = input; // @TODO annotate Type.output with a dollar (Type.$output)
		this._maybepersist ( Type, type );
		gui.Broadcast.dispatch ( null, edb.BROADCAST_OUTPUT, input, context.gui.$contextid );
		return type;
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} b
	 */
	onbroadcast : function ( b ) {
		var map, persist, contextid = b.data;
		if ( b.type === gui.BROADCAST_UNLOAD ) {
			gui.Object.each ( this._persist, function ( instanceid, type ) {
				if ( type.$contextid === contextid ) {
					this._dopersist ( type.constructor.persist, type.constructor, type );
					delete this._persist [ instanceid ];
				}
			}, this );
		}
	},


	// Private ............................................................................

	/**
	 * Experimental.
	 * @type {Map<String,edb.Object|edb.Array>}
	 */
	_persist : {},

	/**
	 * Persist outputted type on shutdown?
	 * @param {function} Type Constructor
	 * @param {edb.Object|edb.Array} type Instance
	 */
	_maybepersist : function ( Type, type ) {
		if ( Type.persist && Type.$classname !== gui.Class.ANONYMOUS ) {
			gui.Broadcast.addGlobal ( gui.BROADCAST_UNLOAD, this );
			this._persist [ type._instanceid ] = type;
		}
	},

	/**
	 * Ad hoc persistance mechanism. 
	 * @TODO something real goes here
	 * @param {String} target
	 * @param {function} Type
	 * @param {edb.Object|edb.Array} type
	 */
	_dopersist : function ( target, Type, type ) {
		var key = Type.$classname;
		switch ( target ) {
			case "session" :
				//sessionStorage.setItem ( key, type.$normalize ());
				break;
			case "local" :
				console.error ( "TODO" );
				break;
			default :
				if ( gui.Type.isFunction ( target )) {
					target.call ( Type, type );
				}
				break;
		}
	}

};