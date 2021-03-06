/**
 * Conceptual superclass for {edb.Object} and {edb.Array}.
 * We use the following only as a pool for mixin methods.
 */
edb.Type = function () {};

/*
 * Types by default take on the structure of whatever JSON you put 
 * into them (as constructor argument). We declare expando properties 
 * with a $dollar prefix so that we may later normalize the JSON back. 
 * Props prefixed by underscore will also be ingnored in this process.
 */
edb.Type.prototype = {
	
	/**
	 * Resource ID (serverside or localstorage key).
	 * @type {String}
	 */
	$id : null,

	/**
	 * Synchronization stuff ohoy. Matches an $instanceid.
	 * @type {String}
	 */
	$originalid : null,
		
	/**
	 * Instance key (clientside session only).
	 * TODO: Safari on iPad would exceed call stack when this property was prefixed with "$" 
	 * because all getters would call $sub which would then get $instkey (ie. overflow).
	 * Why was this only the case only for Safari iPad?
	 * @type {String}
	 */
	_instanceid : null,
	
	/**
	 * Called after $onconstruct (by gui.Class convention).
	 */
	onconstruct : function () {},

	/**
	 * Hello again.
	 */
	ondestruct : function () {},

	/**
	 * Output to context.
	 * @param @optional {edb.IInputHandler} target
	 * @returns {edb.Type}
	 */
	output : function ( target ) {
		edb.Output.dispatch ( this, target );
		return this;
	},

	/**
	 * Garbage collect now, at least in theory.
	 */
	dispose : function () {
		this.$ondestruct ();
	},

	/**
	 * Serialize to abstract EDB tree. Unlike `toJSON`, this 
	 * includes underscore and dollar prefixed properties. 
	 * It also features the the object-properties of arrays.
	 * @param @optional {function} filter
	 * @param @optional {String|number} tabs
	 * @returns {String}
	 */
	serializeToString : function ( filter, tabs ) {
		return new edb.Serializer ().serializeToString ( this, filter, tabs );
	},


	// CRUD .............................................................................

	/**
	 * Warning to use some kind of factory pattern.
	 */
	GET : function () {
		throw new Error ( "Not supported. Use " + this.constructor + ".GET(optionalid)" );
	},

	/**
	 * PUT resource.
	 * @param @optional {Map<String,object>} options
	 * @returns {gui.Then}
	 */
	PUT : function ( options ) {
		return this.constructor.PUT ( this, options );
	},

	/**
	 * POST resource.
	 * @param @optional {Map<String,object>} options
	 * @returns {gui.Then}
	 */
	POST : function ( options ) {
		return this.constructor.POST ( this, options );
	},

	/**
	 * DELETE resource.
	 * @param @optional {Map<String,object>} options
	 * @returns {gui.Then}
	 */
	DELETE : function ( options ) {
		return this.constructor.DELETE ( this, options );
	},


	// Secret ...........................................................................

	/**
	 * Validate persistance on startup.
	 * @TODO: make it less important to forget _super() in the subclass.
	 */
	$onconstruct : function () {
		edb.Type.underscoreinstanceid ( this ); // iOS bug...
		// edb.Type.$confirmpersist ( this );
	},

	/**
	 * Called by {edb.Output} when the output context shuts down 
	 * (when the window unloads or the web worker is terminated).
	 * @TODO: recursively nuke descendant types :)
	 */
	$ondestruct : function () {
		// edb.Type.$maybepersist ( this );
	}
};


// Static .............................................................................

gui.Object.each ({ // static mixins edb.Type

	/*
	 * Dispatch a getter broadcast before base function.
	 */
	getter : gui.Combo.before ( function () {
		gui.Broadcast.dispatch ( this, edb.BROADCAST_ACCESS, this._instanceid );
	}),

	/*
	 * Dispatch a setter broadcast after base function.
	 */
	setter : gui.Combo.after ( function () {
		gui.Broadcast.dispatch ( this, edb.BROADCAST_CHANGE, this._instanceid );
	}),

	/**
	 * Decorate getter methods on prototype.
	 * @param {object} proto Prototype to decorate
	 * @param {Array<String>} methods List of method names
	 * @returns {object}
	 */
	decorateGetters : function ( proto, methods ) {
		methods.forEach ( function ( method ) {
			proto [ method ] = edb.Type.getter ( proto [ method ]);
		});
		return proto;
	},

	/**
	 * Decorate setter methods on prototype.
	 * @param {object} proto Prototype to decorate
	 * @param {Array<String>} methods List of method names
	 * @returns {object}
	 */
	decorateSetters : function ( proto, methods ) {
		methods.forEach ( function ( method ) {
			proto [ method ] = edb.Type.setter ( proto [ method ]);
		});
		return proto;
	},

	/**
	 * Redefine the $instid to start with an underscore 
	 * because of some iOS weirdness (does it still apply?)
	 * @param {edb.Type} inst
	 */
	underscoreinstanceid : function ( inst ) {
		Object.defineProperty ( inst, "_instanceid", {
			value: inst.$instanceid
		});
	},

	/**
	 * Something is an instance of {edb.Object} or {edb.Array}? 
	 * Note: these both inherit an `is` method from `gui.Class`
	 * @param {object} o
	 * @returns {boolean}
	 */
	is : function ( o ) {
		return edb.Object.is ( o ) || edb.Array.is ( o );
	},

	/**
	 * Something is a Type constructor?
	 * @param {object} o
	 * @returns {boolean}
	 */
	isConstructor : function ( o ) {
		return gui.Type.isConstructor ( o ) && o.$classname && 
			gui.Class.ancestorsAndSelf ( o ).some ( function ( C ) {
				return C === edb.Object || C === edb.Array;
			});
	},

	/**
	 * Lookup edb.Type constructor for argument (if not already an edb.Type).
	 * @TODO Confirm that it is actually an edb.Type thing...
	 * @param {Window|WorkerGlobalScope} arg
	 * @param {function|string} arg
	 * @returns {function} 
	 */
	lookup : function ( context, arg ) {	
		var type = null;
		switch ( gui.Type.of ( arg )) {
			case "function" :
				type = arg; // @TODO: confirm
				break;
			case "string" :
				type = gui.Object.lookup ( arg, context );
				break;
			case "object" :
				console.error ( this + ": expected edb.Type constructor (not an object)" );
				break;
		}
		if ( !type ) {
			throw new TypeError ( "The type \"" + arg + "\" does not exist" );
		}
		return type;
	},

	/**
	 * @param {object} value
	 */
	cast : function fix ( value ) {
		if ( gui.Type.isComplex ( value ) && !edb.Type.is ( value )) {
			switch ( gui.Type.of ( value )) {
				case "object" :
					return new edb.Object ( value );
				case "array" :
					return new edb.Array ( value );
			}
		} 
		return value;
	},

	/**
	 * Apply mixins to both {edb.Object} and {edb.Array}.
	 * @param {object} mixins
	 */
	mixin : function ( protos, xstatics, statics ) {
		[ edb.Object, edb.Array ].forEach ( function ( Type ) {
			Type.mixin ( protos, xstatics, statics );
		});
	},

	/**
	 * @param {edb.Object|edb.Array} type
	 * @param {edb.IChangeHandler} handler
	 * @returns {edb.Object}
	 */
	$observe : function ( type, handler ) {
		var id = type.$instanceid || type._instanceid;
		var obs = this._observers;
		var handlers = obs [ id ] || ( obs [ id ] = []);
		if ( handlers.indexOf ( handler ) === -1 ) {
			handlers.push ( handler );
		}
		return type;
	},

	/**
	 * @param {edb.Object} type
	 * @param {edb.IChangeHandler} handler
	 * @returns {edb.Object|edb.Array}
	 */
	$unobserve : function ( type, handler ) {
		var id = type.$instanceid || type._instanceid;
		var obs = this._observers;
		var index, handlers = obs [ id ];
		if ( handlers ) {
			if (( index = handlers.indexOf ( handler )) >-1 ) {
				if ( gui.Array.remove ( handlers, index ) === 0	) {
					delete obs [ id ];
				}
			}
		}
		return type;
	}

}, function mixin ( key, value ) {
	edb.Type [ key ] = value;
});


// Mixins .............................................................................

/**
 * Setup for mixin to {edb.Object} and {edb.Array}.
 */
( function () {

	var iomixins = { // input-output methods

		/**
		 * Instance of this Type has been output 
		 * in window (or worker scope) context?
		 * @returns {boolean}
		 */
		out : function () {
			return edb.Output.out ( this );
		}
	};

	var spassermixins = {

		/**
		 * Create new instance from argument of fuzzy type.
		 * @param {String|object|Array|edb.Object|edb.Array} json
		 * @return {edb.Object|edb.Array}
		 */
		from : gui.Arguments.confirmed ( "(string|object)" ) ( function ( json ) {
			var Type = this;
			if ( json ) {
				if ( edb.Type.is ( json )) {
					json = new edb.Serializer ().serializeToString ( json );
				}
				if ( gui.Type.isString ( json )) {
					if ( json.contains ( "$object" ) || json.contains ( "$array" )) {
						json = new edb.Parser ().parseFromString ( json, null );	
					}
				}
			}
			return new Type ( json );
		})

		/**
		 * Experimental.
		 * @param {object|Array|edb.Object|edb.Array} json
		 * @return {edb.Object|edb.Array}
		 *
		sync : function ( json ) {
			var type;
			if ( edb.Type.is ( json )) {
				json = new edb.Serializer ().serializeToString ( json );
				json = new edb.Parser ().parseFromString ( json, null );
			}
			edb.Relay.$sync = true;
			type = this.from ( json );
			edb.Relay.$sync = false;
			return type;
		}
		*/

	};

	var httpmixins = { // http crud and server resources

		/**
		 * The resource URI-reference is the base URL for 
		 * resources of this type excluding the resource 
		 * primary key. This might be inferred from JSON. 
		 * @type {String}
		 */
		uri : null,

		/**
		 * When requesting a list of resources, a property 
		 * of this name should be found in the JSON for 
		 * each individual resource. The property value 
		 * will be auto-inserted into URL paths when 
		 * the resource is fetched, updated or deleted. 
		 * @type {String}
		 */
		primarykey : "_id",

		/**
		 * GET resource.
		 * 
		 * 1. Any string argument will become the resource ID.
		 * 2. Any object argument will resolve to querystring paramters.
		 *
		 * @param @optional {Map<String,object>|String} arg1
		 * @param @optional {Map<String,object>} arg2
		 * @returns {gui.Then}
		 */
		GET : function () {
			return this.$httpread.apply ( this, arguments );
		},

		/**
		 * PUT resource.
		 * @param {edb.Object|edb.Array} inst
		 * @param @optional {Map<String,object>} options
		 * @param {String} $method (Framework internal)
		 * @returns {gui.Then}
		 */
		PUT : function ( inst, options ) {
			return this.$httpupdate ( "PUT", inst, options );
		},

		/**
		 * POST resource.
		 * @param {edb.Object|edb.Array} inst
		 * @param @optional {Map<String,object>} options
		 * @param {String} $method (Framework internal)
		 * @returns {gui.Then}
		 */
		POST : function ( inst, options ) {
			return this.$httpupdate ( "POST", inst, options );
		},

		/**
		 * DELETE resource.
		 * @param {edb.Object|edb.Array} inst
		 * @param @optional {Map<String,object>} options
		 * @param {String} $method (Framework internal)
		 * @returns {gui.Then}
		 */
		DELETE : function ( inst, options ) {
			return this.$httpupdate ( "DELETE", inst, options );
		},


		// Static secret .......................................................

		/**
		 * GET resource.
		 */
		$httpread : function ( ) {
			var type = this;
			var then = new gui.Then ();
			var href, id, options;
			Array.forEach ( arguments, function ( arg ) {
				switch ( gui.Type.of ( arg )) {
					case "string" :
						id = arg;
						break;
					case "object" :
						options = arg;
						break;
				}
			});
			href = gui.URL.parametrize ( this.uri, options );
			this.$httprequest ( href, "GET", null, function ( response ) {
				then.now ( type.$httpresponse ( response ));
			});
			return then;
		},

		/**
		 * PUT POST DELETE resource.
		 * @param {String} method (Framework internal)
		 * @param {edb.Object|edb.Array} inst
		 * @param @optional {Map<String,object>} options
		 * @returns {gui.Then}
		 */
		$httpupdate : function ( method, inst, options ) {
			var type = this;
			var then = new gui.Then ();
			var href = gui.URL.parametrize ( inst.uri, options );
			var data = gui.Type.isInstance ( inst ) ? inst.toJSON () : inst;
			this.$httprequest ( href, method || "PUT", data, function ( response ) {
				then.now ( type.$httpresponse ( response, options, method ));
			});
			return then;
		},

		/**
		 * Performs the request. Perhaps you would like to overwrite this method.
		 * @TODO: Somehow handle HTTP status codes.
		 * @param {String} url
		 * @param {String} method
		 * @param {object} payload
		 * @param {function} callback
		 */
		$httprequest : function ( url, method, payload, callback ) {
			var request = new gui.Request ( url );
			method = method.toLowerCase ();
			request [ method ] ( payload ).then ( function ( status, data, text ) {
				callback ( data );
			});
		},

		/**
		 * Formats the reponse. Perhaps you would like to overwrite this method. 
		 * If the service returns an object or an array, we assume that the service 
		 * is echoing the posted data and new up an instance of this constructor.
		 * @param {object} response
		 * param @optional {Map<String,object>} options
		 * @param {String} $method GET PUT POST DELETE
		 * @returns {object}
		 */
		$httpresponse : function ( response, options, method ) {
			var Type = this;
			switch ( gui.Type.of ( response )) {
				case "object" :
				case "array" :
					response = new Type ( response );
					break;
			}
			return response;
		}

	};

	/**
	 * Declare the fields on edb.Type.
	 */
	[ iomixins, httpmixins, spassermixins ].forEach ( function ( mixins ) {
		gui.Object.each ( mixins, function mixin ( key, value ) {
			edb.Type [ key ] = value;
		});
	});

	/**
	 * Create one-liner for mixin to subclass constructors recurring static fields.
	 * @returns {Map<String,String|function>}
	 */
	edb.Type.$staticmixins = function () {
		var mixins = {};
		[ httpmixins, iomixins, spassermixins ].forEach ( function ( set ) {
			Object.keys ( set ).forEach ( function ( key ) {
				mixins [ key ] = set [ key ];
			}, this );
		}, this );
		return mixins;
	};

}());