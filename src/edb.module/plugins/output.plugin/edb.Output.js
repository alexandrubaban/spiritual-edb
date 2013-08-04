/**
 * Output input.
 * @TODO add and remove methods.
 */
edb.Output = {

	/**
	 * Temp mechanism while we make namespaces a hard requirement...
	 */
	ERROR_ANONYMOUS : "Cannot ouput ANONYMOUS type. Declare your type in a gui.namespace.",

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
	},

	/**
	 * Type has been output in context?
	 * @returns {boolean}
	 */
	exists : function ( context, Type ) {
		var contextid = context.gui.$contextid;
		var mycontext = this._contexts [ contextid ];
		var classname = Type.$classname;
		return mycontext && mycontext [ classname ];
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} b
	 *
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
	*/

	// Private ............................................................................

	/**
	 * Mapping contextid to map mapping Type classname to Type instance.
	 * @type {Map<String,Map<String,edb.Object|edb.Array>>}
	 */
	_contexts : {},

	/**
	 * Experimental.
	 * @type {Map<String,edb.Object|edb.Array>}
	 *
	_persist : {},
	*/

	/**
	 * Configure instance for output.
	 * @param {edb.Input} input
	 * @param {edb.Object|edb.Array} type Instance
	 */
	_configure : function ( context, type, Type ) {
		var contextid = context.gui.$contextid;
		var mycontext = this._contexts [ contextid ] || ( this._contexts [ contextid ] = {});
		var classname = Type.$classname;
		if ( classname !== gui.Class.ANONYMOUS ) {
			mycontext [ classname ] = type;
			type.$contextid = contextid;
		} else {
			console.error ( this.ERROR_ANONYMOUS, type );
		}
	},

	/**
	 * Configure instance for output. 
	 * @param {Window|WorkerScope} context
	 * @param {edb.Object|edb.Array} type Instance
	 * @param {function} Type Constructor
	 *
	_configure : function ( context, type, Type ) {
		if ( Type.persist && Type.$classname !== gui.Class.ANONYMOUS ) {
			gui.Broadcast.addGlobal ( gui.BROADCAST_UNLOAD, this );
			this._persist [ type._instanceid ] = type;
		}
	},

*/
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
			var contextid = context.gui.$contextid;
			var mycontext = this._contexts [ contextid ];
			var classname = Type.$classname;
			var instanceo = mycontext [ classname ];
			return edb.Input.format ( context, instanceo );
		}
		return null;
	}

};