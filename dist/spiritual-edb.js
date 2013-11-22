/**
 * Spiritual EDB
 * (c) 2013 Wunderbyte
 * Spiritual is freely distributable under the MIT license.
 */
( function ( window ) {

"use strict";


/*
 * Namepace object.
 */
window.edb = gui.namespace ( "edb", {
	
	/**
	 * Logging some debug messages? This can be flipped via meta tag:
	 * `<meta name="edb.debug" content="true"/>`
	 * @type {boolean}
	 */
	debug : false,

	/**
	 * Mount compiled functions as blob files 
	 * (if at all supported) to aid debugging?
	 * This whole feature is disabled for now.
	 * @type {boolean}
	 */
	useblobs : false,

	/**
	 * Broadcasts.
	 */
	BROADCAST_ACCESS : "edb-broadcast-access",
	BROADCAST_CHANGE : "edb-broadcast-change",
	BROADCAST_OUTPUT : "edb-broadcast-output",
	BROADCAST_SCRIPT_INVOKE : "edb-broadcast-script-invoke",

	/**
	 * Ticks.
	 */
	TICK_SCRIPT_UPDATE : "edb-tick-script-update",
	TICK_COLLECT_INPUT : "edb-tick-collect-input",
	TICK_PUBLISH_CHANGES : "edb-tick-update-changes",


	// @TODO: cleanup below somehow ..........................................

	/**
	 * Register action to execute later.
	 * @param {function} action
	 * @param {object} thisp
	 * @returns {function}
	 */
	set : function ( action, thisp ) {
		return edb.Script.$assign ( action, thisp );
	},

	get : function ( key, sig ) {
		return edb.Script.$tempname ( key, sig );
	},

	/**
	 * Execute action.
	 * @TODO: why was this split up in two steps? Sandboxing?
	 * @param {Event} e
	 * @param {String} key
	 * @param @optional {String} sig
	 */
	go : function ( e, key, sig ) { // NOTE: gui.UpdateManager#_attschanged hardcoded "edb.go" ...
		edb.Script.$register ( e );
		edb.Script.$invoke ( key, sig ); // this._log
	}
	
});



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


/**
 * edb.Object
 * @extends {edb.Type} at least in principle.
 * @using {gui.Combo.chained}
 */
edb.Object = ( function using ( chained ) {
	
	return gui.Class.create ( Object.prototype, {
		
		/**
		 * Observe object.
		 * @param @optional {IChangeHandler} handler
		 * @returns {edb.Object}
		 */
		addObserver : chained ( function ( handler ) {
			edb.Object.observe ( this, handler );
		}),

		/**
		 * Unobserve object.
		 * @param @optional {IChangeHandler} handler
		 * @returns {edb.Object}
		 */
		removeObserver : chained ( function ( handler ) {
			edb.Object.unobserve ( this, handler );
		}),


		// Secret ......................................................................

		/**
		 * Constructor.
		 * @overrides {edb.Type#onconstruct}
		 */
		$onconstruct : function ( json ) {
			edb.Type.prototype.$onconstruct.apply ( this, arguments );
			switch ( gui.Type.of ( json )) {
				case "object" : 
				case "undefined" :
				case "null" :
					var proxy = gui.Object.copy ( json || {});
					var types = edb.ObjectPopulator.populate ( proxy, this );
					edb.ObjectProxy.approximate ( proxy, this, types );
					break;
				default :
					throw new TypeError ( 
						"Unexpected edb.Object constructor argument of type " + 
						gui.Type.of ( json ) + ": " + String ( json )
					);
			}
			this.onconstruct ();
			if ( this.oninit ) {
				console.error ( "Deprecated API is deprecated: " + this + ".oninit" );
			}
		},
		
		/**
		 * Create clone of this object filtering out 
		 * underscore and dollar prefixed properties. 
		 * Recursively normalizing nested EDB types.
		 * TODO: WHITELIST stuff that *was* in JSON!
		 * @returns {object}
		 */
		toJSON : function () {
			var c, o = {};
			gui.Object.each ( this, function ( key, value ) {
				c = key.charAt ( 0 );
				if ( c !== "$" && c !== "_" ) {
					if ( edb.Type.is ( value  )) {
						value = value.toJSON ();	
					}
					o [ key ] = value;	
				}
			});
			return o;
		},
		
		/*
		serialize : function () {
			var o = {};
			gui.Object.each ( this, function ( key, value ) {
				if ( edb.Type.is ( value  )) {
					value = value.toJSON ();	
				}
				o [ key ] = value;
			});
			return JSON.stringify ( o );
		}
		*/

		/*
		serialize : function () {
			return gui.Object.extend ({

			}).toJSON ();
		}
		*/

	});

}( gui.Combo.chained ));

/**
 * Mixin static methods. Recurring static members mixed in from {edb.Type}.
 */
edb.Object.mixin ( null, edb.Type.$staticmixins (), {

		/**
		 * Observe.
		 */
		observe : edb.Type.$observe,

		/**
		 * Unobserve.
		 */
		unobserve : edb.Type.$unobserve,
		
		/**
		 * Publishing change summaries async.
		 * @TODO: clean this up...
		 * @TODO: move to edb.Type (edb.Type.observe)
		 * @param {gui.Tick} tick
		 */
		ontick : function ( tick ) {
			var snapshot, changes, change, handlers, observers = this._observers;
			if ( tick.type === edb.TICK_PUBLISH_CHANGES ) {
				snapshot = gui.Object.copy ( this._changes );
				this._changes = Object.create ( null );
				gui.Object.each ( snapshot, function ( instanceid, propdef ) {
					if (( handlers = observers [ instanceid ])) {
						changes = gui.Object.each ( snapshot, function ( id, propdef ) {
							change = propdef [ Object.keys ( propdef )[ 0 ]];
							return id === instanceid ? change : null;
						}).filter ( function ( change ) {
							return change !== null;
						});
						handlers.forEach ( function ( handler ) {
							handler.onchange ( changes );
						});
					}
					gui.Broadcast.dispatch ( null, edb.BROADCAST_CHANGE, instanceid ); // @TODO deprecate
				});
			}
		},


		// Secret static .....................................................................
		
		/*
		 * @TODO this!
		 * 
		$welldefined : function ( json ) {
			return Object.keys ( json ).every ( function ( key ) {
				return ( json [ key ] !== undefined );
			});
		},
		*/

		/**
		 * Publish a notification on property accessors.
		 * @param {String} instanceid
		 * @param {edb.ObjectAccess} access
		 */
		$onaccess : function ( object, name ) {
			var access = new edb.ObjectAccess ( object, name );
			gui.Broadcast.dispatch ( null, edb.BROADCAST_ACCESS, access.instanceid );
		},

		/**
		 * Register change summary for publication (in next tick).
		 * @param {edb.Object} object
		 * @param {String} name
		 * @param {object} oldval
		 * @param {object} newval
		 */
		$onchange : function ( object, name, oldval, newval ) {
			var all = this._changes, id = object._instanceid;
			var set = all [ id ] = all [ id ] || ( all [ id ] = Object.create ( null ));
			set [ name ] = new edb.ObjectChange ( object, name, edb.ObjectChange.TYPE_UPDATE, oldval, newval );
			gui.Tick.dispatch ( edb.TICK_PUBLISH_CHANGES );
		},


		// Private static ....................................................................
		
		/**
		 * Mapping instanceids to lists of observers.
		 * @type {Map<String,Array<edb.IChangeHandler>>}
		 */
		_observers : Object.create ( null ),

		/**
		 * Mapping instanceids to lists of changes.
		 * @type {Map<String,Array<edb.ObjectChange>>}
		 */
		_changes : Object.create ( null ),

});

/*
 * Mixin methods and properties common to both {edb.Object} and {edb.Array}
 */
( function setup () {
	gui.Tick.add ( edb.TICK_PUBLISH_CHANGES, edb.Object );
	gui.Object.extendmissing ( edb.Object.prototype, edb.Type.prototype );
}());


/**
 * @using {Array.prototype}
 * @using {gui.Combo chained}
 */
( function using ( proto, chained ) {

	/**
	 * edb.Array
	 * @extends {edb.Type} (although not really)
	 */
	edb.Array = gui.Class.create ( proto, {

		/**
		 * Push.
		 */
		push : function () {
			var idx = this.length;
			var add = convert ( this, arguments );
			var res = proto.push.apply ( this, add );
			if ( observes ( this )) {
				onchange ( this, idx, null, add );
			}
			return res;
		},
		
		/**
		 * Pop.
		 */
		pop : function () {
			var idx = this.length - 1;
			var res = proto.pop.apply ( this );
			if ( observes ( this )) {
				onchange ( this, idx, [ res ], null );
			}
			return res;
		},
		
		/**
		 * Shift.
		 */
		shift : function () {
			var res = proto.shift.apply ( this );
			if ( observes ( this )) {
				onchange ( this, 0, [ res ], null );
			}
			return res;
		},

		/**
		 * Unshift.
		 */
		unshift : function () {
			var add = convert ( this, arguments );
			var res = proto.unshift.apply ( this, add );
			if ( observes ( this )) {
				onchange ( this, 0, null, add );
			}
			return res;
		},

		/**
		 * Splice.
		 */
		splice : function () {
			var arg = arguments;
			var idx = arg [ 0 ];
			var add = convert ( this, [].slice.call ( arg, 2 ));
			var fix = [ idx, arg [ 1 ]].concat ( add );
			var out = proto.splice.apply ( this, fix );
			if ( observes ( this )) {
				onchange ( this, idx, out, add );
			}
			return out;
		},

		/**
		 * Reverse.
		 */
		reverse : function () {
			if ( observes ( this )) {
				var out = this.toJSON ();
				var add = proto.reverse.apply ( out.slice ());
				onchange ( this, 0, out, add );	
			}
			return proto.reverse.apply ( this );
		},


		// Expandos ...........................................................................

		/**
		 * Just to illustrate that arrays may conveniently get their 
		 * content assigned to a variable name via the arguments list.
		 * @param {Array<object>} members (edb.Types all newed up here)
		 */
		onconstruct : function ( members ) {},

		/**
		 * Observe array (both object properties and list mutations). 
		 * @param @optional {IChangeHandler} handler
		 * @returns {edb.Array}
		 */
		addObserver : chained ( function ( handler ) {
			edb.Object.observe ( this, handler );
			edb.Array.observe ( this, handler );
		}),

		/**
		 * Unobserve array.
		 * @param @optional {IChangeHandler} handler
		 * @returns {edb.Array}
		 */
		removeObserver : chained ( function ( handler ) {
			edb.Object.unobserve ( this, handler );
			edb.Array.unobserve ( this, handler );
		}),

		/**
		 * The content type can be declared as:
		 *
		 * 1. An edb.Type constructor function (my.ns.MyType)
		 * 2. A filter function to accept JSON (for analysis) and return an edb.Type constructor.
		 * @type {function} Type constructor or filter function
		 */
		$of : null,

		/**
		 * Constructor.
		 * @overrides {edb.Type#onconstruct}
		 */
		$onconstruct : function () {
			var object, types;
			object = arguments.length ? arguments [ 0 ].$object || {} : {};  
			edb.Type.prototype.$onconstruct.apply ( this, arguments );
			edb.ArrayPopulator.populate ( this, arguments );
			types = edb.ObjectPopulator.populate ( object, this );
			edb.ObjectProxy.approximate ( object, this, types );
			this.onconstruct ([].slice.call ( this ));
		},

		/**
		 * Create true array without expando properties, recursively normalizing nested EDB 
		 * types. Returns the type of array we would typically transmit back to the server. 
		 * @returns {Array}
		 */
		toJSON : function () {
			return Array.map ( this, function ( thing ) {
				if ( edb.Type.is ( thing )) {
					return thing.toJSON ();
				}
				return thing;
			});
		}
	});

	
	// Helpers ..........................................................

	/**
	 * Convert arguments.
	 * @param {edb.Array} array
	 * @param {Arguments} args
	 * @returns {Array}
	 */
	function convert ( array, args ) {
		return edb.ArrayPopulator.convert ( array, args );
	}

	/**
	 * Shorthand.
	 * @param {edb.Array} array
	 * @param {number} index
	 * @param {Array} removed
	 * @param {Array} added
	 */
	function onchange ( array, index, removed, added ) {
		edb.Array._onchange ( array, index, removed, added );
	}

	/**
	 * Array is being observed?
	 * @param {edb.Array} array
	 * @returns {boolean}
	 */
	function observes ( array ) {
		var key = array.$instanceid || array._instanceid;
		return edb.Array._observers [ key ] ? true : false;
	}
	
}( Array.prototype, gui.Combo.chained ));


/**
 * Mixin static methods. Recurring static members mixed in from {edb.Type}.
 */
edb.Array.mixin ( null, edb.Type.$staticmixins (), {

	/**
	 * Observe.
	 */
	observe : edb.Type.$observe,

	/**
	 * Unobserve.
	 */
	unobserve : edb.Type.$unobserve,

	/**
	 * Something is a subclass constructor of {edb.Array}?
	 * @TODO let's generalize this facility in {gui.Class}
	 */
	isConstructor : function ( o ) {
		return gui.Type.isConstructor ( o ) && 
			gui.Class.ancestorsAndSelf ( o ).indexOf ( edb.Array ) >-1;
	},
	
	/**
	 * Publishing change summaries async.
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {
		var snapshot, handlers, observers = this._observers;
		if ( tick.type === edb.TICK_PUBLISH_CHANGES ) {
			snapshot = gui.Object.copy ( this._changes );
			this._changes = Object.create ( null );
			gui.Object.each ( snapshot, function ( instanceid, changes ) {
				if (( handlers = observers [ instanceid ])) {
					handlers.forEach ( function ( handler ) {
						handler.onchange ( changes );
					});
				}
			});
		}
	},


	// Private static .........................................................

	/**
	 * Mapping instanceids to lists of observers.
	 * @type {Map<String,Array<edb.IChangeHandler>>}
	 */
	_observers : Object.create ( null ),

	/**
	 * Mapping instanceids to lists of changes.
	 * @type {Map<String,Array<edb.ArrayChange>>}
	 */
	_changes : Object.create ( null ),

	/**
	 * TODO.
	 * @param {edb.Array} array
	 */
	_onaccess : function ( array ) {},

	/**
	 * Register change summary for publication in next tick.
	 * @todo http://stackoverflow.com/questions/11919065/sort-an-array-by-the-levenshtein-distance-with-best-performance-in-javascript
	 * @param {edb.Array} array
	 * @param {number} type
	 * @param {object} item
	 */
	_onchange : function ( array, index, removed, added ) {
		var key = array.$instanceid || array._instanceid;
		var all = this._changes;
		var set = all [ key ] || ( all [ key ] = []);
		set.push ( new edb.ArrayChange ( array, index, removed, added ));
		gui.Tick.dispatch ( edb.TICK_PUBLISH_CHANGES );
	},

});


/*
 * Overloading array methods.
 * @using {edb.Array.prototype}
 */
( function using ( proto ) {
	
	/*
	 * Dispatch a broadcast whenever the list is inspected or traversed.
	 */
	edb.Type.decorateGetters ( proto, [
		"filter", 
		"forEach", 
		"every", 
		"map", 
		"some", 
		"indexOf", 
		"lastIndexOf"
	]);

	/*
	 * Dispatch a broadcast whenever the list changes content or structure.
	 * @TODO we now have two systems for this (moving to precise observers)
	 */
	edb.Type.decorateSetters ( proto, [
		"push", // add
		"unshift", // add
		"splice", // add or remove
		"pop", // remove
		"shift", // remove
		"reverse" // reversed (copies???????)
	]);
	
}( edb.Array.prototype ));

/*
 * Mixin methods and properties common 
 * to both {edb.Object} and {edb.Array}
 */
( function setup () {
	gui.Tick.add ( edb.TICK_PUBLISH_CHANGES, edb.Array );
	gui.Object.extendmissing ( edb.Array.prototype, edb.Type.prototype );
}());


/**
 * Populates instance properties. Supports model unfolding 
 * by newing up all that can be indentified as constructors.
 * @using {gui.Type.isDefined}
 * @using {gui.Type.isComplex}, 
 * @using {gui.Type.isFunction} 
 * @using {gui.Type.isConstructor}
 */
edb.ObjectPopulator = ( function using ( isdefined, iscomplex, isfunction, isconstructor ) {

	/**
	 * List non-private fields names from handler that are not 
	 * mixed in from {edb.Type} and not inherited from native.
	 * @param {edb.Object} handler
	 * @returns {Array<String>}
	 */
	function definitions ( handler ) {
		var Type = edb.Object.is ( handler ) ? edb.Object : edb.Array;
		var Base = edb.Object.is ( handler ) ? Object : Array;
		var keys = [], classes = [ edb.Type, Type, Base ];
		gui.Object.all ( handler, function ( key ) {
			if ( isregular ( key ) && classes.every ( function ( o ) {
				return o.prototype [ key ] === undefined;
			})) {
				keys.push ( key );
			}
		});
		return keys;
	}

	/**
	 * @TODO: higher level this feature in {gui.Property}
	 */
	function hiddenprop ( type, name, value ) {
		Object.defineProperty ( type, name, gui.Property.nonenumerable ({
			value : value
		}));
	}

	/**
	 * @TODO: Call this something else...
	 * @param {object} json
	 * @param {edb.Object|edb.Array} type
	 */
	function evalheaders ( json, type ) {
		var id = json.$instanceid;
		if ( id ) {
			hiddenprop ( type, "$originalid", id );
			delete json.$instanceid;
		}
	}

	/**
	 * Fail me once.
	 * @param {String} name
	 * @param {String} key
	 */
	function faildefined ( name, key ) {
		throw new TypeError ( name + " declares \"" + key + "\" as something undefined" );
	}

	/**
	 * Fail me twice.
	 * @param {String} name
	 * @param {String} key
	 */
	function failconstructor ( name, key ) {
		throw new TypeError ( name + " \"" + key + "\" must resolve to a constructor" );
	}

	/**
	 * Object key is not a number and doesn't start with exoctic character? 
	 * @param {String|number} key
	 * @returns {boolean}
	 */
	function isregular ( key ) {
		return key.match ( /^[a-z]/i );
	}


	return { // Public ...............................................................

		/**
		 * Populate object properties of type instance.
		 * @param {object} json
		 * @param {edb.Object|edb.Array} type
		 * @return {Map<String,edb.Object|edb.Array>} types
		 */
		populate : function ( json, type ) {
			var Def, def, val, desc, types = Object.create ( null );
			var base = type.constructor.prototype;
			var name = type.constructor.$classname;
			evalheaders ( json, type );
			definitions ( type ).forEach ( function ( key ) {
				def = type [ key ];
				val = json [ key ];
				if ( isdefined ( val )) {
					if ( isdefined ( def )) {
						if ( iscomplex ( def )) {
							if ( isfunction ( def )) {
								if ( !isconstructor ( def )) {
									def = def ( val );
								}
								if ( isconstructor ( def )) {
									Def = def;
									types [ key ] = new Def ( json [ key ]);
								} else {
									failconstructor ( name, key );
								}
							} else {
								types [ key ] = edb.Type.cast ( isdefined ( val ) ? val : def );
							}
						}
					} else {
						faildefined ( name, key );
					}
				} else {
					if ( isregular ( key ) && edb.Type.isConstructor ( def )) {
						/*
						 * @TODO: cleanup something here
						 */
						if ( edb.Array.isConstructor ( def )) {
							json [ key ] = [];	
						} else {
							json [ key ] = null; // @TODO: stay null somehow...
						}
						Def = def;
						types [ key ] = new Def ( json [ key ]);
					} else {
						if (( desc = Object.getOwnPropertyDescriptor ( base, key ))) {
							Object.defineProperty ( json, key, desc );
						}
					}
				}
			});
			gui.Object.nonmethods ( json ).forEach ( function ( key ) {
				var def = json [ key ];
				if ( isregular ( key ) && gui.Type.isComplex ( def )) {
					if ( !types [ key ]) {
						types [ key ] = edb.Type.cast ( def );
					}
				}
			});
			return types;
		}

	};

}) ( 
	gui.Type.isDefined, 
	gui.Type.isComplex, 
	gui.Type.isFunction, 
	gui.Type.isConstructor
);


/**
 * @using {gui.Type.isConstructor}
 */
edb.ArrayPopulator = ( function () {

	/**
	 * Array was declared to contain lists (not objects)?
	 * @param {edb.Array} array
	 * @returns {boolean}
	 */
	function oflist ( array ) {
		return array.$of && array.$of.prototype.reverse;
	}

	/**
	 * Something is a list?
	 * @param {object} o
	 * @returns {boolean}
	 */
	function islist ( o ) {
		return Array.isArray ( o ) || edb.Array.is ( o );
	}

	/**
	 * Convert via constructor or via filter 
	 * function which returns a constructor.
	 * @param {Array} args
	 * @param {function} func
	 * @returns {Array<edb.Type>}
	 */
	function guidedconvert ( args, func ) {
		var Type = func, is = gui.Type.isConstructor ( Type );
		return args.map ( function ( o ) {
			if ( o !== undefined && !o._instanceid ) {
				Type = is ? Type : func ( o );
				if ( Type.$classid ) {
					o = new Type ( o );
				} else {
					throw new TypeError ();
				}
			}
			return o;
		});
	}

	/**
	 * Objects and arrays automatically converts 
	 * to instances of {edb.Object} and {edb.Array} 
	 * @param {Array} args
	 * @returns {Array}
	 */
	function autoconvert ( args ) {
		return args.map ( function ( o ) {
			if ( !edb.Type.is ( o )) {
				switch ( gui.Type.of ( o )) {
					case "object" : 
						return new edb.Object ( o );
					case "array" :
						return new edb.Array ( o );
				}
			}
			return o;
		});
	}

	return { // Public .........................................................

		/**
		 * Populate {edb.Array} from constructor arguments. This works like normal 
		 * arrays, except for the scenario where 1) the content model of the array 
		 * is NOT arrays (ie. not a dimensional array) and 2) the first argument IS 
		 * an array OR an {edb.Array} in which case the first members of this list 
		 * will populate into the array and the remaining arguments will be ignored. 
		 * @TODO read something about http://www.2ality.com/2011/08/spreading.html
		 * @param {edb.Array}
		 * @param {Arguments} args
		 */
		populate : function ( array, args ) {
			var first = args [ 0 ];
			if ( first ) {
				if ( !oflist ( array ) && islist ( first )) {
					args = first;
				}
				Array.prototype.push.apply ( array, 
					this.convert ( array, args )
				);
			}
		},

		/**
		 * Convert arguments.
		 * @param {edb.Array} array
		 * @param {Arguments|array} args
		 * @returns {Array}
		 */
		convert : function ( array, args ) {
			args = gui.Array.from ( args );
			if ( gui.Type.isFunction ( array.$of )) {
				return guidedconvert ( args, array.$of );
			} else {
				return autoconvert ( args );
			}
		}

	};

}());


edb.ObjectProxy = ( function () {

	/**
	 * Create observable getter for key.
	 * @param {String} key
	 * @param {function} base
	 * @returns {function}
	 */
	function getter ( key, base ) {
		return function () {
			var result = base.apply ( this );
			edb.Object.$onaccess ( this, key );
			return result;
		};
	}

	/**
	 * Create observable setter for key.
	 * @param {String} key
	 * @param {function} base
	 * @returns {function}
	 */
	function setter ( key, base ) {
		return function ( newval ) {
			var oldval = this [ key ]; // @TODO suspend something?
			base.apply ( this, arguments );
			if ( newval !== oldval ) {
				edb.Object.$onchange ( this, key, oldval, newval );
				oldval = newval;
			}
		};
	}

	return { // Public ............................................................................

		/**
		 * Simplistic proxy mechanism to dispatch broadcasts on getters and setters.
		 * @param {object} target The object whose properties are being intercepted (the JSON object)
		 * @param {edb.Object} handler The edb.Object instance that intercepts all the properties
		 */
		approximate : function ( target, handler, types ) {

			/* 
			 * 1. Objects by default convert to edb.Object
			 * 2. Arrays by default convert to edb.Array
			 * 3. Simple properties get target accessors
			 *
			 * @TODO: Setup now proxies array indexes, 
			 * unsupport this or re-approximate on changes
			 *
			 * @TODO: when resetting array, make sure that 
			 * it becomes xx.MyArray (not plain edb.Array)
			 */
			gui.Object.nonmethods ( target ).forEach ( function ( key ) {
				var desc = Object.getOwnPropertyDescriptor ( target, key );
				if ( desc.configurable ) {
					Object.defineProperty ( handler, key, {
						enumerable : desc.enumerable,
						configurable : desc.configurable,
						get : getter ( key, function () {
							if ( desc.get ) {
								return desc.get.call ( this );
							} else {
								return types [ key ] || target [ key ];
							}
						}),
						set : setter ( key, function ( value ) {
							var Type, type;
							if ( desc.set ) {
								desc.set.call ( this, value );
							} else {
								if (( type = types [ key ])) {
									Type = type.constructor; // @TODO: filter function support!
									types [ key ] = new Type ( value );
								} else {
									target [ key ] = edb.Type.cast ( value );
								}
							
							}
						})
					});
				}
			});
			gui.Object.ownmethods ( target ).forEach ( function ( key ) {
				handler [ key ] = target [ key ];
			});
		}
	};

}());


/**
 * @param {edb.Type} object
 * @param {String} name
 */
edb.ObjectAccess = function ( object, name ) {
	this.instanceid = object._instanceid; // @todo are we using this?
	this.object = object;
	this.name = name;
};

edb.ObjectAccess.prototype = {
	instanceid : null,
	object : null,
	name : null
};


/**
 * @param {edb.Array} array
 */
edb.ArrayAccess = function ( array ) {
	this.array = array;
};

edb.ArrayAccess.prototype = {
	array : null
};


/**
 * Micro change summary.
 */
edb.Change = function () {};
edb.Change.prototype = {

	/**
	 * Type that changed.
	 * @type {edb.Object|edb.Array}
	 */
	object : null,

	/**
	 * Update type.
	 * @type {String}
	 */
	type : null
};


/**
 * edb.Object change summary.
 * @extends {edb.Change}
 * @param {edb.Object} object
 * @param {String} name
 * @param {String} type
 * @param {object} oldval
 * @param {object} newval
 */
edb.ObjectChange = function ( object, name, type, oldval, newval ) {
	this.object = object;
	this.name = name;
	this.type = type;
	this.oldValue = oldval;
	this.newValue = newval;
};

// gui.Object.create ( edb.Change.prototype, {

edb.ObjectChange.prototype = {
	name: null,
	oldValue: undefined,
	newValue: undefined
};

/**
 * We only support type "updated" until 
 * native 'Object.observe' comes along.
 * @type {String}
 */
edb.ObjectChange.TYPE_UPDATE = "update";


/**
 * @see http://wiki.ecmascript.org/doku.php?id=harmony:observe#array.observe
 * @param {edb.Array} array
 */
edb.ArrayChange = function ( array, index, removed, added ) {
	this.type = edb.ArrayChange.TYPE_SPLICE; // hardcoded for now
	this.object = array;
	this.index = index;
	this.removed = removed || [];
	this.added = added || [];
};

edb.ArrayChange.prototype = gui.Object.create ( edb.Change.prototype, {

	/**
	 * Index of change.
	 * @type {}
	 */
	index : -1,

	/**
	 * List removed members.
	 * @todo What should happen to them?
	 * @type {Array}
	 */
	removed : null,

	/**
	 * List added members.
	 * @type {Array}
	 */
	added : null

});

/*
 * Update types. We'll stick to `splice` for now.
 */
edb.ArrayChange.TYPE_SPLICE = "splice";

/**
 * Given a `splice` change, compute the arguments required 
 * to cause or reproduce the change using `array.splice()`.
 * @see http://mdn.io/splice
 */
edb.ArrayChange.toSpliceParams = function ( change ) {
	if ( change.type === edb.ArrayChange.TYPE_SPLICE ) {
		var idx = change.index;
		var out = change.removed.length;
		var add = change.added;
		return [ idx, out ].concat ( add );
	} else {
		throw new TypeError ();
	}
};


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
	 * @param @optional {object} target
	 */
	dispatch : function ( type, target ) {
		var handler, input = this._configure ( type.constructor, type );
		if ( target ) {
			if (( handler = target.$oninput || target.oninput )) {
				handler.call ( target, input );
			}
		} else {
			gui.Broadcast.dispatch ( null, edb.BROADCAST_OUTPUT, input );
		}
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


/**
 * @deprecated
 * Note: This plugin may be used standalone, so don't reference any spirits around here.
 * @TODO formalize how this is supposed to be clear
 * @TODO static interface for all this stuff
 */
edb.OutputPlugin = gui.Plugin.extend ({

	/**
	 * Output data as type.
	 * @param {object} data JSON object or array (demands arg 2) or an edb.Type instance (omit arg 2).
	 * @param @optional {function|String} type edb.Type constructor or "my.ns.MyType"
	 * @returns {edb.Object|edb.Array}
	 */
	dispatch : function ( data, Type ) {
		console.error ( "edb.OutputPlugin is deprecated" );
		return edb.Output.dispatch ( this.context, data, Type );
	},

	/**
	 * Given Type has been output already?
	 * @param {edb.Object|edb.Array} Type
	 * @returns {boolean}
	 */
	exists : function ( Type ) {
		console.error ( "edb.OutputPlugin is deprecated" );
		return edb.Output.out ( Type, this.context || self );
	}

});


/**
 * Adopt the format of {gui.Broadcast} to facilitate easy switch cases 
 * on the Type constructor instead of complicated 'instanceof' checks. 
 * The Type instance object may be picked out of the 'data' property.
 * @param {edb.Object|edb.Array} type
 */
edb.Input = function Input ( type ) {
	this.$instanceid = gui.KeyMaster.generateKey ();
	if ( edb.Type.is ( type )) {
		this.type = type.constructor;
		this.data = type;
	} else {
		throw new TypeError ( type + " is not a Type" );
	}
};

edb.Input.prototype = {

	/**
	 * Input Type (function constructor)
	 * @type {function}
	 */
	type : null,
	
	/**
	 * Input instance (instance of this.Type)
	 * @type {object|edb.Type} data
	 */
	data : null,

	/**
	 * Uniquely identifies the input.
	 * @type {String}
	 */
	$instanceid : null,

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Input]";
	}
};


/**
 * Tracking EDB input. Note that the {edb.Script} is using this plugin: Don't assume a spirit around here.
 * @extends {gui.Tracker}
 */
edb.InputPlugin = gui.Tracker.extend ({
   
	/**
	 * True when one of each expected input type has been collected.
	 * @type {boolean}
	 */
	done : true,

	/**
	 * Construction time.
	 * @overrides {gui.Tracker#construct}
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		this.context = self; // @TODO: deprecate this whole thing...
		this._watches = [];
		this._matches = [];
		this._needing = [];
	},

	/**
	 * Destruction time.
	 */
	ondestruct : function () {
		this._super.ondestruct ();
		this.remove ( this._watches );
	},
	
	/**
	 * Add handler for one or more input types.
	 * @param {edb.Type|String|Array<edb.Type|String>} arg 
	 * @param @optional {IInputHandler} handler Defaults to this.spirit
	 * @param @optional {IInputHandler} handler Defaults to this.spirit
	 * @returns {gui.InputPlugin}
	 */
	add : gui.Combo.chained ( function ( arg, handler, required ) {
		handler = handler ? handler : this.spirit;
		arg = edb.InputPlugin._breakdown ( arg, this.context );
		if ( arg.length ) {
			this.done = this.done && required === false;
			this._add ( arg, handler, required );
			this._subscribe ( true );
		}
	}),


	/**
	 * Remove handler for one or more input types.
	 * @TODO Cleanup more stuff?
	 * @param {edb.Type|String|Array<edb.Type|String>} arg 
	 * @param @optional {IInputHandler} handler Defaults to this.spirit
	 * @returns {gui.InputPlugin}
	 */
	remove : gui.Combo.chained ( function ( arg, handler ) {
		handler = handler ? handler : this.spirit;
		arg = edb.InputPlugin._breakdown ( arg, this.context );
		if ( arg.length ) {
			this._remove ( arg, handler );
			this.done = this._done ();
		}
	}),

	/**
	 * Get data for latest input of type (or best match).
	 * @TODO Safeguard somewhat
	 * @param {function} type
	 * @returns {object}
	 */
	get : function ( type ) {
		var types = this._matches.map ( function ( input ) {
			return input.data.constructor;
		});
		var best = edb.InputPlugin._bestmatch ( type, types );
		var input = best ? this._matches.filter ( function ( input ) {
			return input.type === best;
		}).shift () : null;
		return input ? input.data : null;
	},

	/**
	 * Evaluate new input.
	 * @param {gui.Broadcast} b
	 */
	onbroadcast : function ( b ) {
		if ( b.type === edb.BROADCAST_OUTPUT ) {
			this.match ( b.data );
		}
	},

	/**
	 * Collect matching input.
	 * @param {edb.Input} input
	 */
	match : function ( input ) {
		if ( this._matches.every ( function ( match ) {
			return match.$instanceid !== input.$instanceid;
		})) {
			this._maybeinput ( input );
		}
	},
	
	
	// PRIVATES ...............................................................................
	
	/**
	 * Expecting instances of these types (or best match).
	 * @type {Array<function>}
	 */
	_watches : null,

	/**
	 * Latest (best) matches, one of each expected type.
	 * @type {Array<edb.Input>} 
	 */
	_matches : null,

	/**
	 * ?
	 */
	_needing : null,

	/**
	 * Add input handler for types.
	 * @param {Array<function>} types
	 * @param {IInputHandler} handler
	 * @param {boolean} required
	 */
	_add : function ( types, handler, required ) {
		types.forEach ( function ( Type ) {
			if ( gui.Type.isDefined ( Type )) {
				this._addchecks ( Type.$classid, [ handler ]);
				this._watches.push ( Type );
				if ( required ) {
					this._needing.push ( Type );
				}
			} else {
				throw new TypeError ( "Could not register input for undefined Type" );
			}
		}, this );
		types.forEach ( function ( Type ) {
			if ( Type.out ( this.context )) { // type has been output already?
				this._maybeinput ( edb.Output.$get ( Type, this.context ));
			}
		}, this );
	},

	/**
	 * Remove input handler for types.
	 * @param {Array<function>} types
	 * @param {IInputHandler} handler
	 */
	_remove : function ( types, handler ) {
		types.forEach ( function ( Type ) {
			gui.Array.remove ( this._watches, Type );
			gui.Array.remove ( this._needing, Type );
			this._removechecks ( Type.$classid, [ handler ]);
			if ( !this._watches.length ) {
				this._subscribe ( false );
			}
		}, this );
	},

	/**
	 * If input matches registered type, update handlers.
	 * @param {edb.Input} input
	 */
	_maybeinput : function ( input ) {
		var best = edb.InputPlugin._bestmatch ( input.type, this._watches );
		if ( best ) {
			this._updatematch ( input );
			this.done = this._done ();
			this._updatehandlers ( input );
		}
	},

	/**
	 * Register match for type (remove old match if any).
	 * @param {edb.Input} input
	 * @param {function} best
	 */
	_updatematch : function ( newinput, newbest ) {
		var matches = this._matches;
		var types = matches.map ( function ( input ) {
			return input.type;
		});
		var best = edb.InputPlugin._bestmatch ( newinput.type, types );
		if ( best ) {
			var oldinput = matches.filter ( function ( input ) {
				return input.type === best;
			})[ 0 ];
			var index = matches.indexOf ( oldinput );
			matches [ index ] = newinput;
		} else {
			matches.push ( newinput );
		}
	},

	/**
	 * Update input handlers.
	 * @param {edb.Input} input
	 */
	_updatehandlers : function ( input ) {
		gui.Class.ancestorsAndSelf ( input.type, function ( Type ) {
			var list = this._trackedtypes [ Type.$classid ];
			if ( list ) {
				list.forEach ( function ( checks ) {
					var handler = checks [ 0 ];
					handler.oninput ( input );
				});
			}
		}, this );
	},

	/**
	 * Required inputs was required?
	 * @returns {boolean}
	 */
	_done : function () {
		var needs = this._needing;
		var haves = this._matches;
		return needs.every ( function ( Type ) {
			return haves.some ( function ( input ) {
				return ( input.data instanceof Type );
			});
		});
	},

	/**
	 * @param {boolean} is
	 */
	_subscribe : function ( is ) {
		gui.Broadcast [ is ? "add" : "remove" ] ( edb.BROADCAST_OUTPUT, this, this.context.gui.$contextid );
	}


}, {}, { // Static .............................................................

	/**
	 * Breakdown argument into array of one or more types.
	 * @param {object} arg
	 * @param {Window} context
	 * @returns {Array<function>}
	 */
	_breakdown : function ( arg, context ) {
		if ( gui.Type.isArray ( arg )) {
			return this._breakarray ( arg, context );
		} else {
			return this._breakother ( arg, context );
		}
	},
	
	/**
	 * Breakdown array.
	 * @param {Array<function|String|object>}
	 * @returns {Array<function>}
	 * @param {Window} context
	 * @returns {Array<function>}
	 */
	_breakarray : function ( array, context ) {
		return array.map ( function ( o ) {
			switch ( gui.Type.of ( o )) {
				case "function" :
					return o;
				case "string" :
					return gui.Object.lookup ( o, context );
				case "object" :
					console.error ( "Expected function. Got object." );
			}
		}, this );
	},
	
	/**
	 * Breakdown unarray.
	 * @param {function|String|object} arg
	 * @returns {Array<function>}
	 * @param {Window} context
	 * @returns {Array<function>}
	 */
	_breakother : function ( arg, context ) {
		switch ( gui.Type.of ( arg )) {
			case "function" :
				return [ arg ];
			case "string" :
				return this._breakarray ( arg.split ( " " ), context );
			case "object" :
				console.error ( "Expected function. Got object." );
		}
	},

	/**
	 * Lookup ancestor or identical constructor.
	 * @param {function} target type constructor
	 * @param {Array<function>} types type constructors
	 * @returns {function} type constructor
	 */
	_bestmatch : function ( target, types ) {
		var best = null, rating = Number.MAX_VALUE;
		this._rateall ( target, types, function ( type, rate ) {
			if ( rate >-1 && rate < rating ) {
				best = type;
			}
		});
		return best;
	},

	/**
	 * Match all types.
	 * @param {function} t
	 * @param {Array<function>} types
	 * @param {function} action
	 */
	_rateall : function ( target, types, action ) {
		types.forEach ( function ( type ) {
			action ( type, this._rateone ( target, type ));
		}, this );
	},

	/**
	 * Match single type.
	 * @type {function} t
	 * @type {function} type
	 * @returns {number} -1 for no match
	 */
	_rateone : function ( target, type ) {
		if ( target === type ) {
			return 0;
		} else {
			var tops = gui.Class.ancestorsAndSelf ( target );
			var subs = gui.Class.descendantsAndSelf ( target );
			var itop = tops.indexOf ( type );
			var isub = subs.indexOf ( type );
			return itop < 0 ? isub : itop;
		}
	}

});


/**
 * The ScriptPlugin shall render the spirits HTML.
 * @extends {gui.Plugin}
 * @using {gui.Combo.chained}
 * @using {gui.Arguments.confirmed}
 */
edb.ScriptPlugin = ( function using ( chained, confirmed ) {

	return gui.Plugin.extend ({

		/**
		 * Script has been loaded?
		 * @type {boolean}
		 */
		loaded : false,

		/**
		 * Script has been run? Flipped after first run. 
		 * @todo Rename this to something professional.
		 * @type {boolean}
		 */
		ran : false,

		/**
		 * Log development stuff to console?
		 * @type {boolean}
		 */
		debug : false,

		/**
		 * Hijacking the {edb.InputPlugin} which has been 
		 * designed to work without an associated spirit.
		 * @type {edb.InputPlugin}
		 */
		input : null,

		/**
		 * Construction time.
		 */
		onconstruct : function () {
			this._super.onconstruct ();
			this.inputs = this.inputs.bind ( this );
		},

		/**
		 * Destruction time.
		 */
		ondestruct : function () {
			this._super.ondestruct ();
			if ( this.loaded ) {
				this.spirit.life.remove ( gui.LIFE_ENTER, this );
				gui.Tick.remove ( edb.TICK_SCRIPT_UPDATE, this );
				gui.Broadcast.remove ([
					edb.BROADCAST_ACCESS,
					edb.BROADCAST_CHANGE
				], this );
				if ( this.input ) {
					this.input.ondestruct ();
				}
			}
		},

		/**
		 * Load script.
		 * @param {function|String} script
		 * @returns {edb.ScriptPlugin}
		 */
		load : chained ( confirmed ( "function|string" ) ( function ( script ) {
			if (( script = script.bind ? script : gui.Object.lookup ( script ))) {
				this.loaded = true;
				this._script = script;
				this._updater = new edb.UpdateManager ( this.spirit );
				this._process ( script.$instructions );
				if ( !this.input ) {
					this.run ();
				}
			}
		})),

		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {
			this.input.match ( input );
			if ( this.input.done ) {
				this.run ();
			}
		},

		/**
		 * Run script and write result to DOM.
		 */
		run : function ( /* arguments */ ) {
			if ( this.loaded ) {
				if ( this.spirit.life.entered ) {
					this.write ( this._run.apply ( this, arguments ));
				} else {
					this.spirit.life.add ( gui.LIFE_ENTER, this );
					this._arguments = arguments;
				}
			} else {
				console.error ( this.spirit, "No script loaded" );
			}
		},
		
		/**
		 * Write the actual HTML to screen. You should probably only 
		 * call this method if you are producing your own markup 
		 * somehow, ie. not using EDBML templates out of the box. 
		 * @param {String} html
		 */
		write : function ( html ) {
			var changed = this._html !== html;
			if ( changed ) {
				this._html = html;
				this._stayfocused ( function () {
					this._updater.update ( html );
				});
				this.spirit.onrender ({ // @TODO: some kind of RenderSummary...
					changed : changed,
					first : !this.ran
				});
			}
			this.ran = true;
		},

		/**
		 * Get input of type.
		 * @param {function} Type
		 * @returns {object}
		 */
		inputs : function ( Type ) {
			return this.input.get ( Type );
		},

		/**
		 * Handle broadcast.
		 * @param {gui.Broadcast} broadcast
		 */
		onbroadcast : function ( b ) {
			var keys = this._triggers;
			switch ( b.type ) {
				case edb.BROADCAST_ACCESS :
					keys [ b.data ] = true;
					break;
				case edb.BROADCAST_CHANGE :
					if ( keys [ b.data ]) {
						var tick = edb.TICK_SCRIPT_UPDATE;
						gui.Tick.one ( tick, this ).dispatch ( tick, 0 );	
					}
					break;
			}
		},

		/**
		 * Tick allows for multiple model updates to trigger a single rendering.
		 * @param {gui.Tick} tick
		 */
		ontick : function ( tick ) {
			switch ( tick.type ) {
				case edb.TICK_SCRIPT_UPDATE :
					this.run ();
					break;
			}
		},

		/**
		 * @param {gui.Life} life
		 */
		onlife : function ( l ) {
			if ( l.type === gui.LIFE_ENTER ) {
				this.spirit.life.remove ( l.type, this );
				if ( this._arguments ) {
					this.run.apply ( this, this._arguments );
				}
			}
		},


		// PRIVATES .......................................................

		/**
		 * Script SRC.
		 * @type {String}
		 */
		_src : null,

		/**
		 * Script thing.
		 * @type {edb.Script}
		 */
		_script : null,

		/**
		 * Update manager. 
		 * @type {edb.UpdateManager}
		 */
		_updater : null,

		/**
		 * Mapping keys broadcasted from edb.Objects to trigger repaint.
		 * @type {Map<String,boolean>} 
		 */
		_triggers : null,

		/**
		 * Cache arguments for postponed execution.
		 * @type {Arguments}
		 */
		_arguments : null,

		/**
		 * Snapshot latest HTML to avoid parsing duplicates.
		 * @type {String}
		 */
		_html : null,

		/**
		 * Parse processing instructions. Add input listeners in 
		 * batch to prevent prematurly getting a `this.input.done`
		 * @param {Array<object>} pis
		 */
		_process : function ( pis ) {
			if ( pis ) {
				var optional = []; 
				var required = [];
				if ( pis.reduce ( function ( hasinput, pi ) {
					if ( pi.type === "input" ) {
						var list = pi.atts.required === false ? optional : required;
						list.push ( gui.Object.lookup ( pi.atts.type ));
						return true;
					}
					return hasinput ;
				}, false )) {
					this.input = new edb.InputPlugin ();
					this.input.add ( required, this, true );
					this.input.add ( optional, this, false );
				}
			}
		},

		/**
		 * Add-remove broadcast handlers.
		 * @param {boolean} isBuilding
		 */
		_subscribe : function ( isBuilding ) {
			gui.Broadcast [ isBuilding ? "add" : "remove" ] ( edb.BROADCAST_ACCESS, this );
			gui.Broadcast [ isBuilding ? "remove" : "add" ] ( edb.BROADCAST_CHANGE, this );
		},

		/**
		 * Run the script while maintaining broadcast setup.
		 * @returns {String}
		 */
		_run : function ( /* arguments */ ) {
			this._triggers = {};
			this._subscribe ( true );
			var html = this._script.apply ( this.spirit, arguments );
			this._subscribe ( false );
			return html;
		},

		// @TODO: move below elsewhere ..................................................

		/**
		 * Preserve form field focus before and after action.
		 * @param {function} action
		 */
		_stayfocused : function ( action ) {
			var field, selector = edb.EDBModule.fieldselector;
			action.call ( this );
			if ( selector ) {
				field = gui.DOMPlugin.q ( this.spirit.document, selector );
				if ( field && "#" + field.id !== selector ) {
					if ( field && gui.DOMPlugin.contains ( this.spirit, field )) {
						field.focus ();
						var text = "textarea,input:not([type=checkbox]):not([type=radio])";
						if ( gui.CSSPlugin.matches ( field, text )) {
							field.setSelectionRange ( 
								field.value.length, 
								field.value.length 
							);
						}
						this._restorefocus ( field );
						// this._debugwarning (); TODO: this fires when it shouldn't!
					}
				}
			}
		},

		/**
		 * Focus form field.
		 * @param {Element} field
		 */
		_restorefocus : function ( field ) {
			var text = "textarea,input:not([type=checkbox]):not([type=radio])";
			field.focus ();
			if ( gui.CSSPlugin.matches ( field, text )) {
				field.setSelectionRange ( 
					field.value.length, 
					field.value.length 
				);
			}
		},

		/**
		 * We're only gonna say this once.
		 */
		_debugwarning : function () {
			var This = edb.ScriptPlugin;
			if ( This._warning && this.spirit.window.gui.debug ) {
				console.debug ( This._warning );
				This._warning = null;
			}
		}


	}, {}, { // Static .......................................................

		/**
		 * @TODO: STACK LOST ANYWAY!
		 * @type {String}
		 */
		_warning : "Spiritual: Form elements with a unique @id may be updated without losing the undo-redo stack (now gone)."

	});

}( gui.Combo.chained, gui.Arguments.confirmed ));


/**
 * Spirit of the compiled EDBML script.
 */
edb.ScriptSpirit = gui.Spirit.extend ({

	/**
	 * Expected configured via inline HTML.
	 * @type {String}
	 */
	id : null,

	/**
	 * Load script into parent spirit. This spirit will 
	 * automatically destruct when the script executes.
	 */
	onenter : function () {
		this._super.onenter ();
		var id, parent = this.dom.parent ( gui.Spirit );
		if ( parent && ( id = this.id )) {
			parent.script.load ( gui.Object.lookup ( id ));
		}
	}

});


/**
 * Crawl structures descending.
 */
edb.Crawler = ( function () {

	function Crawler () {}
	Crawler.prototype = {

		/**
		 * 
		 */
		crawl : function ( type, handler ) {
			if ( edb.Type.is ( type )) {
				handle ( type, handler );
				crawl ( type, handler );
			} else {
				throw new TypeError ();
			}
		}
	};

	function crawl ( type, handler ) {
		gui.Object.each ( type, istype ).forEach ( 
			function ( type ) {
				handle ( type, handler );
				crawl ( type,handler );
			}
		);
	}

	function istype ( key, value ) {
		if ( edb.Type.is ( value )) {
			return value;
		}
	}

	function handle ( type, handler ) {
		if ( handler.ontype ) {
			handler.ontype ( type );
		}
		if ( handler.onarray ) {
			if ( edb.Array.is ( type )) {
				handler.onarray ( type );
			}
		}
		if ( handler.onobject ) {
			if ( edb.Object.is ( type )) {
				handler.onobject ( type );
			}
		}
	}

	return Crawler;

}());


edb.Serializer = ( function () {

	function Serializer () {}
	Serializer.prototype = {

		/**
		 * Serialize type.
		 * @param {edb.Object|edb.Array} type
		 * @param @optional {function} filter
		 * @param @optional {String|number} tabs
		 * @returns {String}
		 */
		serializeToString : function ( type, filter, tabs ) {
			if ( isType ( type )) {
				return JSON.stringify ( parse ( type ), filter, tabs );
			} else {
				alert ( type );
				throw new TypeError ( "Expected edb.Object|edb.Array" );
			}
		}	
	};

	/**
	 * Thing is a type?
	 * @param {object} thing
	 * @returns {boolean}
	 */
	function isType ( thing ) {
		return edb.Type.is ( thing );
	}

	/**
	 * Thing is edb.Array?
	 * @param {object} thing
	 * @returns {boolean}
	 */
	function isArray ( type ) {
		return edb.Array.is ( type );
	}

	/**
	 * Parse as object node or array node.
	 */
	function parse ( type ) {
		return isArray ( type ) ? asArray ( type ) : asObject ( type );
	}

	/**
	 * Compute object node.
	 * @param {edb.Object|edb.Array} type
	 * @returns {object}
	 */
	function asObject ( type ) {
		var map = gui.Object.map ( type, mapObject, type );
		return {
			$object : gui.Object.extend ( map, {
				$classname : type.$classname,
				$instanceid : type.$instanceid
			})
		};
	}

	/**
	 * Compute array node.
	 * @param {edb.Object|edb.Array} type
	 * @returns {object}
	 */
	function asArray ( type ) {
		return gui.Object.extend ( asObject ( type ), {
			$array : mapArray ( type )
		});
	}

	/**
	 * Map the object properties of a type. 
	 * Skip all array intrinsic properties.
	 * @param {String} key
	 * @param {object} value
	 */
	function mapObject ( key, value ) {
		if ( isArray ( this ) && key.match ( /^length|^\d+/ )) {
			return undefined;
		} else {
			return isType ( value ) ? parse ( value ) : value;
		}
	}

	/**
	 * Map array members.
	 * @param {edb.Array} type
	 */
	function mapArray ( type ) {
		return Array.map ( type, function ( thing ) {
			return isType ( thing ) ? parse ( thing ) : thing;
		});
	}

	return Serializer;

}());


edb.Parser = ( function () {

	function Parser () {}
	Parser.prototype = {

		/**
		 * @returns {edb.Object|edb.Array}
		 */
		parseFromString : function ( json, type ) {
			json = JSON.parse ( json );
			if ( isType ( json )) {
				return parse ( json, type );
			} else {
				throw new TypeError ( "Expected serialized edb.Object|edb.Array" );
			}
		}
	};

	/**
	 * @returns {edb.Object|edb.Array}
	 */
	function parse ( json, type ) {
		var Type, name;
		if ( type === null ) {}
		else if ( type ) {			
			name = type.$classname || name;
			Type = name ? type : gui.Object.lookup ( name );
		} else {
			name = json.$object.$classname;
			Type = gui.Object.lookup ( name );
		}
		json = mapValue ( json );
		if ( type === null ) {
			return json;
		} else if ( Type ) {
			return Type.from ( json );
		} else {
			throw new TypeError ( name + " is not defined" );	
		}
	}

	/**
	 * Is typed node?
	 * @param {object} json
	 * @returns {boolean}
	 */
	function isType ( json ) {
		return gui.Type.isComplex ( json ) && ( json.$array || json.$object );
	}

	/**
	 * Parse node as typed instance.
	 * @param {object} type
	 * @return {object}
	 */
	function asObject ( type ) {
		return gui.Object.map ( type.$object, mapObject );
	}

	/**
	 * Parse array node to array members (transform from object to array). 
	 * 
	 * @returns {}
	 */
	function asArray ( type ) {
		var members = type.$array.map ( mapValue );
		members.$object = type.$object;
		return members;
	}

	/**
	 * @returns {}
	 */
	function mapObject ( key, value ) {
		return mapValue ( value );
	}

	/**
	 * @returns {}
	 */
	function mapValue ( value ) {
		if ( isType ( value )) {
			return value.$array ? asArray ( value ) : asObject ( value );
		}
		return value;
	}

	return Parser;

}());


/**
 * Converts JS props to HTML attributes during EDBML rendering phase. 
 * Any methods added to this prototype will become available in EDBML 
 * scripts as: att.mymethod() TODO: How can Att instances be passed?
 * @param @optional Map<String,object> atts Default properties
 */
edb.Att = function Att ( atts ) {
	if ( atts ) {
		gui.Object.extend ( this, atts );
	}
};

edb.Att.prototype = gui.Object.create ( null, {

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Att]";
	},

	/**
	 * Resolve key-value to HTML attribute declaration.
	 * @TODO Rename "_html"
	 * @param {String} att
	 * @returns {String} 
	 */
	_out : function ( att ) {
		var val = this [ att ], html = "";
		switch ( gui.Type.of ( val )) {
			case "null" :
			case "undefined" :
				break;
			default :
				val = edb.Att.encode ( this [ att ]);
				html += att + "=\"" + val + "\" ";
				break;
		}
		return html;
	},

	/**
	 * Resolve key-value, then delete it to prevent reuse.
	 * @param {String} att
	 */
	_pop : function ( att ) {
		var html = this._out ( att );
		delete this [ att ];
		return html;
	},

	/**
	 * Resolve all key-values to HTML attribute declarations.
	 * @returns {String} 
	 */
	_all : function () {
		var html = "";
		gui.Object.nonmethods ( this ).forEach ( function ( att ) {
			html += this._out ( att );
		}, this );
		return html;
	}

});

/**
 * @static
 * Stringify stuff to be used as HTML attribute values.
 * @param {object} data
 * @returns {String}
 */
edb.Att.encode = function ( data ) {
	var type = gui.Type.of ( data );
	switch ( type ) {
		case "string" :
			break;
		case "number" :
		case "boolean" :
			data = String ( data );
			break;
		case "object" :
		case "array" :
			try {
				data = encodeURIComponent ( JSON.stringify ( data ));
			} catch ( jsonex ) {
				throw new Error ( "Could not create HTML attribute: " + jsonex );
			}
			break;
		case "date" :
			throw new Error ( "TODO: edb.Att.encode standard date format?" );
		default :
			throw new Error ( "Could not create HTML attribute for " + type );
	}
	return data;
};


/**
 * Collects HTML output during EDBML rendering phase.
 * Any methods added to this prototype will become 
 * available in EDBML scripts as: out.mymethod()
 */
edb.Out = function Out () {};

edb.Out.prototype = {

	/**
	 * HTML string (not well-formed while parsing).
	 * @type {String}
	 */
	html : "",

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Out]";
	},

	/**
	 * Get HTML result (output override scenario).
	 * @returns {String}
	 */
	write : function () {
		return this.html;
	}
};


/**
 * @TODO: Clean this up some day.
 */
edb.Script = {

	/**
	 * @static
	 * Map function to generated key and return the key.
	 * @param {function} func
	 * @param {object} thisp
	 * @returns {String}
	 */
	$assign : function ( func, thisp ) {
		var key = gui.KeyMaster.generateKey ();
		edb.Script._invokables [ key ] = function ( value, checked ) {
			return func.apply ( thisp, [ gui.Type.cast ( value ), checked ]);
		};
		return key;
	},

	/**
	 * Garbage collect function that isn't called by the 
	 * GUI using whatever strategy they prefer nowadays.
	 */
	$revoke : function ( key ) {
		edb.Script._invokables [ key ] = null; // garbage one
		delete edb.Script._invokables [ key ]; // garbage two
	},

	/**
	 * @static
	 * TODO: Revoke invokable on spirit destruct (release memory)
	 * @param {string} key
	 * @param @optional {String} sig
	 * @param @optional {Map<String,object>} log
	 */
	$invoke : function ( key, sig, log ) {
		var func = null;
		log = log || this._log;
		/*
		  * Relay invokation to edb.Script in sandboxed context?
		 */
		if ( sig ) {
			gui.Broadcast.dispatchGlobal ( this, edb.BROADCAST_SCRIPT_INVOKE, {
				key : key,
				sig : sig,
				log : log
			});
		} else {
			/*
			 * Timeout is a cosmetic stunt to unfreeze a pressed 
			 * button in case the function takes a while to complete. 
			 */
			if (( func = this._invokables [ key ])) {
				if ( log ) {
					if ( log.type === "click" ) {
						gui.Tick.next ( function () {
							func ( log.value, log.checked );
						});
					} else {
						func ( log.value, log.checked );
					}
				} else {
					func ();
				}
			} else {
				throw new Error ( "Invokable does not exist: " + key );
			}
		}
	},

	/**
	 * Keep a log on the latest DOM event.
	 * @param {Event} e
	 */
	$register : function ( e ) {
		this._log = e ? {
			type : e.type,
			value : e.target.value,
			checked : e.target.checked
		} : null;
		return this;
	},

	/**
	 * Yerh.
	 */
	$tempname : function ( key, sig ) {
		var func;
		if ( sig ) {
			console.error ( "TODO" );
		} else {
			if (( func = this._invokables [ key ])) {
				return func ();
			} else {
				throw new Error ( "out of synch" );
			}
		}
	},
	

	// Private ..................................

	/**
	 * @static
	 * Mapping compiled functions to keys.
	 * @type {Map<String,function>}
	 */
	_invokables : Object.create ( null ),

	/**
	 * Loggin event details.
	 * @type {Map<String,object>}
	 */
	_log : null

};


/**
 * Utilities for the {edb.UpdateManager}.
 */
edb.UpdateAssistant = {

	/**
	 * @static
	 * Get ID for element.
	 * @param {Element} element
	 * @returns {String}
	 */
	id : function ( element ) {
		return gui.Type.isDefined ( element.id ) ? 
			element.id || null : 
			element.getAttribute ( "id" ) || null;
	},

	/**
	 * @static
	 * Parse markup to element.
	 * TODO: Use DOMParser versus "text/html" for browsers that support it?
	 * TODO: All sorts of edge cases for IE6 compatibility. Hooray for HTML5.
	 * TODO: Evaluate well-formedness in debug mode for XHTML documents.
	 * @param {Document} doc
	 * @param {String} markup
	 * @param {String} id
	 * @param {Element} element
	 * @returns {Element}
	 */
	parse : function ( doc, markup, id, element ) { // gonna need to know the parent element type here...
		/*
		 * TODO: run this by the gui.HTMLParser for maximum backwards lameness with TABLE and friends
		 */
		element = doc.createElement ( element.localName );
		element.innerHTML = markup;
		element.id = id;
		// TODO: Plugin this!
		Array.forEach ( element.querySelectorAll ( "option" ), function ( option ) {
			switch ( option.getAttribute ( "selected" )) {
				case "true" :
					option.setAttribute ( "selected", "selected" );
					break;
				case "false" :
					option.removeAttribute ( "selected" );
					break;
			}
		});
		// TODO: Plugin this!
		Array.forEach ( element.querySelectorAll ( "input[type=checkbox],input[type=radio]" ), function ( option ) {
			switch ( option.getAttribute ( "checked" )) {
				case "true" :
					option.setAttribute ( "checked", "checked" );
					break;
				case "false" :
					option.removeAttribute ( "checked" );
					break;
			}
		});
		return element;
	},

	/**
	 * @static
	 * Mapping element id to it's ordinal position.
	 * @returns {Map<String,number>}
	 */
	order : function ( nodes ) {
		var order = new Map ();
		Array.forEach ( nodes, function ( node, index ) {
			if ( node.nodeType === Node.ELEMENT_NODE ) {
				order.set ( this.id ( node ), index );
			}
		}, this );
		return order;
	},
	
	/**
	 * @static
	 * Convert an NodeList into an ID-to-element map.
	 * @param {NodeList} nodes
	 * @return {Map<String,Element>}
	 */
	index : function ( nodes ) {
		var result = Object.create ( null );
		Array.forEach ( nodes, function ( node, index ) {
			if ( node.nodeType === Node.ELEMENT_NODE ) {
				result [ this.id ( node )] = node;
			}
		}, this );
		return result;
	}	
};


/**
 * It's the update manager.
 * @param {gui.Spirit} spirit
 */
edb.UpdateManager = function UpdateManager ( spirit ) {
	this._keyid = spirit.dom.id () || spirit.$instanceid;
	this._spirit = spirit;
	this._doc = spirit.document;
};

edb.UpdateManager.prototype = {

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.UpdateManager]";
	},
	
	/**
	 * Update.
	 * @param {String} html
	 */
	update : function ( html ) {
		this._updates = new edb.UpdateCollector ();
		this._functions = {};
		if ( !this._olddom ) {
			this._first ( html );
		} else {
			this._next ( html );
			this._updates.collect ( 
				new edb.FunctionUpdate ( this._doc ).setup ( 
					this._keyid, 
					this._functions 
				)
			);
		}
		this._updates.eachRelevant ( function ( update ) {
			update.update ();
			update.dispose ();
		});
		//this._fisse ( this._functions );
		//edb.FunctionUpdate.remap ( this._spirit, this._functions );
		if ( this._updates ) { // huh? how can it be null?
			this._updates.dispose ();
		}
		delete this._updates;
	},
	
	
	// PRIVATE ..............................................................

	/**
	 * This can be one of two:
	 * 1) Spirit element ID (if element has ID).
	 * 2) Spirits $instanceid (if no element ID).
	 * @type {String}
	 */
	_keyid : null,

	/**
	 * Spirit document.
	 * @type {Document}
	 */
	_doc : null,

	/**
	 * Associated spirit.
	 * @type {gui.Spirit}
	 */
	_spirit : null,
		
	/**
	 * Current DOM subtree.
	 * @type {Document}
	 */
	_olddom : null,
	
	/**
	 * Incoming DOM subtree.
	 * @type {Document}
	 */
	_nedwdom : null,
	
	/**
	 * List of updates to apply.
	 * @type {[type]}
	 */
	_updates : null,

	/**
	 * Assistant utilities.
	 * @type {edb.UpdateAssistant}
	 */
	_assistant : edb.UpdateAssistant,
	
	/**
	 * First update (always a hard update).
	 * @param {String} html
	 */
	_first : function ( html ) {
		this._olddom = this._parse ( html );
		this._updates.collect ( 
			new edb.HardUpdate ( this._doc ).setup ( this._keyid, this._olddom )
		);
	},

	/**
	 * Next update.
	 * @param {String} html
	 */
	_next : function ( html ) {
		this._newdom = this._parse ( html );
		this._crawl ( this._newdom, this._olddom, this._newdom, this._keyid, {});
		this._olddom = this._newdom;
	},

	/**
	 * Parse markup to element.
	 * @param {String} html
	 * @returns {Element}
	 */
	_parse : function ( html ) {
		return this._assistant.parse ( 
			this._doc, 
			html, 
			this._keyid, 
			this._spirit.element 
		);
	},
	
	/**
	 * Crawl.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Element} lastnode
	 * @param {String} id
	 * @param {Map<String,boolean>} ids
	 * @returns {boolean}
	 */
	_crawl : function ( newchild, oldchild, lastnode, id, ids ) {
		var result = true;
		while ( newchild && oldchild && !this._updates.hardupdates ( id )) {
			switch ( newchild.nodeType ) {
				case Node.TEXT_NODE :
					result = this._check ( newchild, oldchild, lastnode, id, ids );
					break;
				case Node.ELEMENT_NODE :
					result = this._scan ( newchild, oldchild, lastnode, id, ids );
					break;
			}
			newchild = newchild.nextSibling;
			oldchild = oldchild.nextSibling;
		}
		return result;
	},

	/**
	 * Scan elements.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Element} lastnode
	 * @param {String} id
	 * @param {Map<String,boolean>} ids
	 * @returns {boolean}
	 */
	_scan : function ( newnode, oldnode, lastnode, id, ids ) {
		var result = true, oldid = this._assistant.id ( oldnode );
		if (( result = this._check ( newnode, oldnode, lastnode, id, ids )))  {	
			if ( oldid ) {
				ids = gui.Object.copy ( ids );
				lastnode = newnode;
				ids [ oldid ] = true;
				id = oldid;
			}
			result = this._crawl ( newnode.firstChild, oldnode.firstChild, lastnode, id, ids );
		}
		return result;
	},
	
	/**
	 * Hello.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Element} lastnode
	 * @param {String} id
	 * @param {Map<String,boolean>} ids
	 * @returns {boolean}
	 */
	_check : function ( newnode, oldnode, lastnode, id, ids ) {
		var result = true;
		var isSoftUpdate = false;
		var isPluginUpdate = false; // TODO: plugins...
		if (( newnode && !oldnode ) || ( !newnode && oldnode )) {  
			result = false;
		} else if (( result = newnode.nodeType === oldnode.nodeType )) {
			switch ( oldnode.nodeType ) {
				case Node.TEXT_NODE :
					if ( newnode.data !== oldnode.data ) {
						result = false;
					}
					break;
				case Node.ELEMENT_NODE :
					if (( result = this._familiar ( newnode, oldnode ))) {
						if (( result = this._checkatts ( newnode, oldnode, ids ))) {
							if ( this._maybesoft ( newnode, oldnode )) {
								if ( this._confirmsoft ( newnode, oldnode )) {
									this._updatesoft ( newnode, oldnode, ids );
									isSoftUpdate = true; // prevents the replace update
								}
								result = false; // crawling continued in _updatesoft
							} else {
								if ( oldnode.localName !== "textarea" ) { // TODO: better forms support!
									result = newnode.childNodes.length === oldnode.childNodes.length;
									if ( !result && oldnode.id ) {
										lastnode = newnode;
										id = oldnode.id;
									}
								}
							}
						}
					}
					break;
			}
		}
		if ( !result && !isSoftUpdate && !isPluginUpdate ) {
			this._updates.collect ( new edb.FunctionUpdate ( this._doc ).setup ( id ));
			this._updates.collect ( new edb.HardUpdate ( this._doc ).setup ( id, lastnode ));
		}
		return result;
	},

	/**
	 * Roughly estimate whether two elements could be identical.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @returns {boolean}
	 */
	_familiar : function ( newnode, oldnode ) {
		return [ "namespaceURI", "localName" ].every ( function ( prop ) {
			return newnode [ prop ] === oldnode [ prop ];
		});
	},
	
	/**
   * Same id trigges attribute synchronization;
	 * different id triggers hard update of ancestor.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Map<String,boolean>} ids
	 * @returns {boolean} When false, replace "hard" and stop crawling.
	 */
	_checkatts : function ( newnode, oldnode, ids ) {
		var result = true;
		var update = null;
		if ( this._attschanged ( newnode.attributes, oldnode.attributes, ids )) {
			var newid = this._assistant.id ( newnode );
			var oldid = this._assistant.id ( oldnode );
			if ( newid && newid === oldid ) {
				update = new edb.AttsUpdate ( this._doc ).setup ( oldid, newnode, oldnode );
				this._updates.collect ( update, ids );
			} else {
				result = false;
			}
		}
		return result;
	},

	/**
	 * Attributes changed? When an attribute update is triggered by a EDB poke, we verify 
	 * that this was the *only* thing that changed and substitute the default update with 
	 * a edb.FunctionUpdate. This will bypass the need  for an ID attribute on the associated 
	 * element (without which a hardupdate would happen).
	 * @see {edb.FunctionUpdate}
	 * @param {NodeList} newatts
	 * @param {NodeList} oldatts
	 * @param {?} ids
	 * @returns {boolean}
	 */
	_attschanged : function ( newatts, oldatts, ids ) {
		var changed = newatts.length !== oldatts.length;
		if ( !changed ) {
			changed = !Array.every ( newatts, function ischanged ( newatt ) {
				var oldatt = oldatts.getNamedItem ( newatt.name );
				return oldatt && oldatt.value === newatt.value;
			});
			if ( changed ) {
				changed = !Array.every ( newatts, function isfunctionchanged ( newatt ) {
					var oldatt = oldatts.getNamedItem ( newatt.name );
					if ( this._functionchanged ( newatt.value, oldatt.value ) ) {
						return true;
					} else {
						return newatt.value === oldatt.value;
					}
				}, this );
			}
		}
		return changed;
	},

	_functionchanged : function ( newval, oldval ) {
		var newkeys = gui.KeyMaster.extractKey ( newval );
		var oldkeys = gui.KeyMaster.extractKey ( oldval );
		if ( newkeys && oldkeys ) {
			oldkeys.forEach ( function ( oldkey, i ) {
				this._functions [ oldkey ] = newkeys [ i ];
			}, this );
			return true;
		}
		return false;
	},
	
	/**
	 * Are element children candidates for "soft" sibling updates?
	 * 1) Both parents must have the same ID
	 * 2) All children must have a specified ID
	 * 3) All children must be elements or whitespace-only textnodes
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @return {boolean}
	 */
	_maybesoft : function ( newnode, oldnode ) {
		if ( newnode && oldnode ) {
			return newnode.id && newnode.id === oldnode.id && 
				this._maybesoft ( newnode ) && 
				this._maybesoft ( oldnode );
		} else {	
			return Array.every ( newnode.childNodes, function ( node ) {
				var res = true;
				switch ( node.nodeType ) {
					case Node.TEXT_NODE :
						res = node.data.trim () === "";
						break;
					case Node.ELEMENT_NODE :
						res = this._assistant.id ( node ) !== null;
						break;
				}
				return res;
			}, this );
		}
	},

	/**
	 * "soft" siblings can only be inserted and removed. This method verifies that 
	 * elements retain their relative positioning before and after an update. Changing 
	 * the ordinal position of elements is not supported since this might destruct UI 
	 * state (moving eg. an iframe around using DOM methods would reload the iframe). 
	 * TODO: Default support ordering and make it opt-out instead?
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @returns {boolean}
	 */
	_confirmsoft : function ( newnode, oldnode ) {
		var res = true, prev = null;
		var oldorder = this._assistant.order ( oldnode.childNodes );
		return Array.every ( newnode.childNodes, function ( node, index ) {
			if ( node.nodeType === Node.ELEMENT_NODE ) {
				var id = this._assistant.id ( node );
				if ( oldorder.has ( id ) && oldorder.has ( prev )) {
					res = oldorder.get ( id ) > oldorder.get ( prev );
				}
				prev = id;
			}
			return res;
		}, this );
	},
	
	/**
	 * Update "soft" siblings.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Map<String,boolean>} ids
	 * @return {boolean}
	 */
	_updatesoft : function ( newnode, oldnode, ids ) {
		var updates = [];
		var news = this._assistant.index ( newnode.childNodes );
		var olds = this._assistant.index ( oldnode.childNodes );
		/*
		 * Add elements?
		 */
		var child = newnode.lastElementChild,
			topid = this._assistant.id ( oldnode ),
			oldid = null,
			newid = null;
		while ( child ) {
			newid = this._assistant.id ( child );
			if ( !olds [ newid ]) {
				if ( oldid ) {
					updates.push (
						new edb.InsertUpdate ( this._doc ).setup ( oldid, child ) 
					);
				} else {
					updates.push (
						new edb.AppendUpdate ( this._doc ).setup ( topid, child ) 
					);
				}
			} else {
				oldid = newid;
			}
			child = child.previousElementSibling;
		}
		
		/*
		 * Remove elements?
		 */
		Object.keys ( olds ).forEach ( function ( id ) {
			if ( !news [ id ]) {
				updates.push (
					new edb.RemoveUpdate ( this._doc ).setup ( id ) 
				);
				updates.push (
					new edb.FunctionUpdate ( this._doc ).setup ( id ) 
				);
			} else { // note that crawling continues here...
				var n1 = news [ id ];
				var n2 = olds [ id ];
				this._scan ( n1, n2, n1, id, ids );
			}
		}, this );
		
		/*
		 * Register updates
		 */
		updates.reverse ().forEach ( function ( update ) {
			this._updates.collect ( update, ids );
		}, this );
	}
};


/**
 * We collect updates over-aggresively in an attempt to traverse 
 * the DOM tree in one direction only. The fellow will helps us 
 * reduce the collected updates to the minimum required subset.
 */
edb.UpdateCollector = function UpdateCollector () {
	this._updates = []; 
	this._hardupdates = new Set ();
};

edb.UpdateCollector.prototype = {
	
	/**
	 * Collecting updates.
	 * @type {Array<edb.Update>}
	 */
	_updates : null,

	/**
	 * Tracking hard-updated element IDs.
	 * @type {Set<String>}
	 */
	_hardupdates : null,

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.UpdateCollector]";
	},

	/**
	 * Collect update candidate. All updates may not be evaluated, see below.
	 * @param {edb.Update} update
	 * @param {Map<String,boolean>} ids Indexing ID of ancestor elements
	 * @returns {edb.UpdateCollector}
	 */
	collect : function ( update, ids ) {
		this._updates.push ( update );
		if ( update.type === edb.Update.TYPE_HARD ) {
			this._hardupdates.add ( update.id );
		} else {
			update.ids = ids || {};
		}
		return this;
	},

	/**
	 * Will this element be hardupdated?
	 * @param {String} id Element ID
	 * @returns {boolean}
	 */
	hardupdates : function ( id ) {
		return this._hardupdates.has ( id );
	},

	/**
	 * Apply action to all relevant updates. For example: 
	 * An attribute update is not considered relevant if 
	 * the parent is scheduled to perform a full replace 
	 * of it's children.
	 * @param {function} action
	 */
	eachRelevant : function ( action ) {
		this._updates.filter ( function ( update ) {
			return ( 
				update.type === edb.Update.TYPE_HARD || 
				Object.keys ( update.ids ).every ( function ( id ) {
					return !this.hardupdates ( id );
				}, this )
			);
		}, this ).forEach ( function ( update ) {
			action ( update );
		});
	},

	/**
	 * TODO: At some point, figure out what exactly to do here.
	 */
	dispose : function () {
		delete this._hardupdates;
		delete this._updates;
	}
};


/**
 * Year!
 */
edb.Update = gui.Class.create ( Object.prototype, {
		
	/**
	 * Matches hard|atts|insert|append|remove|function
	 * @type {String}
	 */
	type : null,
	
	/**
	 * Identifies associated element in one of two ways:
	 *
	 * 1) It's the id of an element in this.window. Or if no id:
	 * 2) It's the $instanceid of a {gui.Spirít} in this.window
	 * @see  {edb.Update#element}
	 * @type {String}
	 */
	id : null,

	/**
	 * Tracking ancestor element IDs. We use this to regulate whether an 
	 * update should be discarded because a hard replace has obsoleted it.
	 * @type {Map<String,boolean>}
	 */
	ids : null,
	
	/**
	 * Update context window.
	 * @type {Window}
	 */
	window : null,
	
	/**
	 * Update context document.
	 * @type {Document}
	 */
	document : null,
	
	/**
	 * Invoked when update is newed up.
	 * @param {Document} doc
	 */
	onconstruct : function ( doc ) {
		this.window = doc.defaultView;
		this.document = doc;
	},
	
	/**
	 * Hello.
	 * @returns {edb.Update}
	 */
	setup : function () {
		return this;
	},
	
	/**
	 * The update method performs the actual update. Expect methods  
	 * _beforeUpdate and _afterUpdate to be invoked at this point.
	 */
	update : function () {},
	
	/**
	 * Get element associated to this.id. Depending on update type, 
	 * this element will be removed or added or updated and so on.
	 * The root element (the one whose spirit is assigned the script) 
	 * may be indexed by "$instanceid" if no ID attribute is specified.
	 * @returns {Element}
	 */
	element : function () {
		var spirit, element = null;
		if ( gui.KeyMaster.isKey ( this.id )) {
			if (( spirit = this.window.gui.get ( this.id ))) {
				element = spirit.element;
			}
		}
		element = element || this.document.getElementById ( this.id );
		if ( !element ) {
			console.error ( "No element to match @id: " + this.id );
		}
		return element;
	},

	/**
	 * Clean stuff up for what it's worth.
	 */
	dispose: function () {
		this.window = null;
		this.document = null;
	},
	
	
	// Private ...................................................................
	
	/**
	 * When something changed, dispatch pre-update event. 
	 * @param {Element} element
	 * @return {boolean}
	 */
	_beforeUpdate : function ( element ) {
		var event = "x-beforeupdate-" + this.type;
		return this._dispatch ( element, event );
	},
	
	/**
	 * When something changed, dispatch post-update event.
	 * @param {Element} element
	 * @return {boolean}
	 */
	_afterUpdate : function ( element ) {
		var event = "x-afterupdate-" + this.type;
		return this._dispatch ( element, event );
	},
	
	/**
	 * Dispatch bubbling DOM event for potential handlers to intercept the update.
	 * @TODO: Investigate CustomEvent support in our browser stack...
	 * @param {Element} element
	 * @param {String} name
	 * @return {boolean} False if event was canceled
	 */
	_dispatch : function ( element, name ) {
		var event = this.document.createEvent ( "UIEvents" );
		event.initEvent ( name, true, true );
		return element.dispatchEvent ( event );
	},
	
	/**
	 * Report update in debug mode.
	 * @param {String} report
	 */
	_report : function ( report ) {
		if ( edb.debug ) {
			if ( gui.KeyMaster.isKey ( this.id )) {
				report = report.replace ( this.id, "(anonymous)" );
			}
			console.debug ( report );
		}
	}
	

}, {}, { // Static .......................................................
	
	/**
	 * Default replace update. A section of the DOM tree is replaced. 
	 * {@see ReplaceUpdate}
	 * @type {String}
	 */
	TYPE_HARD : "hard",

	/**
	 * Attribute update. The element must have an ID specified.
	 * {@see UpdateManager#hasSoftAttributes}
	 * {@see AttributesUpdate}
	 * @type {String}
	 */
	TYPE_ATTS : "atts",

	/**
	 * Insertion update: Inserts a child without replacing the parent. Child 
	 * siblings must all be Elements and they must all have an ID specified.
	 * {@see SiblingUpdate}
	 * @type {String}
	 */
	TYPE_INSERT : "insert",

	/**
	 * {@see SiblingUpdate}
	 * @type {String}
	 */
	TYPE_APPEND : "append",

	/**
	 * Removal update: Removes a child without replacing the parent. Child 
	 * siblings must all be Elements and they must all have an ID specified.
	 * {@see SiblingUpdate}
	 * @type {String}
	 */
	TYPE_REMOVE : "remove",

	/**
	 * EDB function update. Dereferencing functions bound to GUI 
	 * events that are no longer associated to any DOM element.
	 * @type {String}
	 */
	TYPE_FUNCTION : "function"

});


/**
 * Update attributes. Except for the ID which 
 * is required to be the same before and after.
 */
edb.AttsUpdate = edb.Update.extend ({
	
	/**edv
	 * Update type.
	 * @type {String}
	 */
	type : edb.Update.TYPE_ATTS,
	
	/**
	 * (XML) element before update.
	 * @type {Element}  
	 */
	_xold : null,
	
	/**
	 * (XML) element after update. 
	 * @type {Element}  
	 */
	_xnew : null,
	
	/**
	 * Tracking attribute changes for debugging.
	 * @type {Array<String>}
	 */
	_summary : null,
	
	/**
	 * Construct.
	 * @param {Document} doc
	 */
	onconstruct : function ( doc ) {
		this._super.onconstruct ( doc );
		this._summary = [];
	},
	
	/**
	 * Setup update.
	 * @param {String} id
	 * @param {Element} xnew
	 * @param {Element} xold
	 * @returns {edb.AttsUpdate}
	 */
	setup : function ( id, xnew, xold ) {
		this._super.setup ();
		this.id = id;
		this._xnew = xnew;
		this._xold = xold;
		return this;
	},
	
	/**
	 * Update attributes.
	 */
	update : function () {
		this._super.update ();
		var element = this.element ();
		if ( this._beforeUpdate ( element )) {
			this._update ( element );
			this._afterUpdate ( element );
			this._report ();
		}
	},
	
	/**
	 * Better not keep a reference to any DOM element around here.
	 * @overrides {edb.Update#dispose}
	 */
	dispose : function () {
		this._super.dispose ();
		delete this._xold;
		delete this._xnew;
	},
	
	
	// PRIVATE ....................................................................
	
	/**
	 * Actually update attributes.
	 * 1. Create and update attributes.
	 * 2. Remove attributes
	 * @param {HTMLElement} element
	 */
	_update : function ( element ) {
		Array.forEach ( this._xnew.attributes, function ( newatt ) {
			var oldatt = this._xold.getAttribute ( newatt.name );
			if ( oldatt === null || oldatt !== newatt.value ) {
				this._set ( element, newatt.name, newatt.value );
				this._summary.push ( "@" + newatt.name );
			}
		}, this );
		Array.forEach ( this._xold.attributes, function ( oldatt ) {
			if ( !this._xnew.hasAttribute ( oldatt.name )) {
				this._del ( element, oldatt.name, null );
				this._summary.push ( "@" + oldatt.value );
			}
		}, this );
	},
	
	/**
	 * Set element attribute. 
	 * @param {Element} element
	 * @param {String} name
	 * @param {String} value
	 * @return
	 */
	_set : function ( element, name, value ) {
		var spirit = element.spirit;
		if ( spirit ) {
			spirit.att.set ( name, value );
		} else {
			element.setAttribute ( name, value );
			switch ( name ) {
				case "checked" :
					if ( !element.checked ) {
						element.checked = true;
					}
					break;
				case "value" :
					if ( element.value !== value ) {
						element.value = String ( value ); // ?
					}
					break;
			}
		}
	},

	/**
	 * Set element attribute. 
	 * @param {Element} element
	 * @param {String} name
	 * @param {String} value
	 * @return
	 */
	_del : function ( element, name ) {
		var spirit = element.spirit;
		if ( spirit ) {
			spirit.att.del ( name ); // TODO!!!!!!!!!!!!!!
		} else {
			switch ( name ) {
				case "checked" :
					element.checked = false;
					break;
				default :
					element.removeAttribute ( name );
					break;
			}
		}
	},
	
	/**
	 * Debug changes.
	 */
	_report : function () {
		this._super._report ( "edb.AttsUpdate \"#" + this.id + "\" " + this._summary.join ( ", " ));
	}
	
});


/**
 * Hey.
 */
edb.HardUpdate = edb.Update.extend ({
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : edb.Update.TYPE_HARD,
	
	/**
	 * XML element.
	 * @type {Element}
	 */
	xelement : null,
	
	/**
	 * Setup update.
	 * @param {String} id
	 * @param {Element} xelement
	 * @returns {edb.HardUpdate}
	 */
	setup : function ( id, xelement ) {
		this._super.setup ();
		this.id = id;
		this.xelement = xelement;
		return this;
	},
	
	/**
	 * Replace target subtree. 
	 */
	update : function () {
		this._super.update ();
		var element = this.element ();
		if ( element && this._beforeUpdate ( element )) {
			//gui.DOMPlugin.html ( element, this.xelement.outerHTML );
			gui.DOMPlugin.html ( element, this.xelement.innerHTML );
			this._afterUpdate ( element );
			this._report ();
		}
	},
	
	/**
	 * Clean up.
	 */
	dispose : function () {
		this._super.dispose ();
		delete this.xelement;
	},
	
	
	// PRIVATE ..........................................................................
	
	/**
	 * Hello.
	 */
	_report : function () {
		this._super._report ( "edb.HardUpdate #" + this.id );
	}
});


/**
 * Soft update.
 * @extends {edb.Update}
 */
edb.SoftUpdate = edb.Update.extend ({
	
	/**
	 * XML element stuff (not used by edb.RemoveUpdate).
	 * @type {Element}
	 */
	xelement : null,
	
	/**
	 * Update type defined by descendants. 
	 * Matches insert|append|remove
	 * @type {String}
	 */
	type : null,
	
	/**
	 * Clean stuff up for what it's worth.
	 */
	dispose : function () {
		this._super.dispose ();
		delete this.xelement;
	},
	
	/**
	 * TODO: make static, argument xelement
	 * Convert XML element to HTML element. Method document.importNode can not 
	 * be used in Firefox, it will kill stuff such as the document.forms object.
	 * TODO: Support namespaces and what not
	 * @param {HTMLElement} element
	 */
	_import : function ( parent ) {
		var temp = this.document.createElement ( parent.nodeName );
		temp.innerHTML = this.xelement.outerHTML;
		return temp.firstChild;
	}
});


/**
 * Insert.
 * @extends {edb.SoftUpdate}
 */
edb.InsertUpdate = edb.SoftUpdate.extend ({
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : edb.Update.TYPE_INSERT,
	
	/**
	 * XML element.
	 * @type {Element}
	 */
	xelement : null,
	
	/**
	 * Setup update.
	 * @param {String} id Insert before this ID
	 * @param {Element} xelement
	 * @returns {edb.InsertUpdate}
	 */
	setup : function ( id, xelement ) {
		this.id = id;
		this.xelement = xelement;
		return this;
	},
	
	/**
	 * Execute update.
	 */
	update : function () {
		var sibling = this.element ();
		var parent = sibling.parentNode;
		var child = this._import ( parent );
		if ( this._beforeUpdate ( parent )) {
			parent.insertBefore ( child, sibling );
			this._afterUpdate ( child );
			this._report ();
		}
	},
	
	/**
	 * Report.
	 * TODO: Push to update manager.
	 */
	_report : function () {
		this._super._report ( "edb.InsertUpdate #" + this.xelement.getAttribute ( "id" ));
	}
});


/**
 * Append.
 * @extends {edb.SoftUpdate}
 */
edb.AppendUpdate = edb.SoftUpdate.extend ({
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : edb.Update.TYPE_APPEND,
	
	/**
	 * Setup update.
	 * @param {String} id
	 * @param {Element} xelement
	 * @returns {edb.AppendUpdate}
	 */
	setup : function ( id, xelement ) {
		this.id = id;
		this.xelement = xelement;
		return this;
	},
	
	/**
	 * Execute update.
	 */
	update : function () {
		var parent = this.element ();
		var child = this._import ( parent );
		if ( this._beforeUpdate ( parent )) {
			parent.appendChild ( child );
			this._afterUpdate ( child );
			this._report ();
		}
	},
	
	/**
	 * Report.
	 * TODO: Push to update manager.
	 */
	_report : function () {
		this._super._report ( "edb.AppendUpdate #" + this.xelement.getAttribute ( "id" ));
	}
});


/**
 * Remove.
 * @extends {edb.SoftUpdate}
 */
edb.RemoveUpdate = edb.SoftUpdate.extend ({
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : edb.Update.TYPE_REMOVE,
	
	/**
	 * Setup update.
	 * @param {String} id
	 * @returns {edb.RemoveUpdate}
	 */
	setup : function ( id ) {
		this.id = id;
		return this;
	},
	
	/**
	 * Execute update.
	 */
	update : function () {
		var element = this.element ();
		var parent = element.parentNode;
		if ( this._beforeUpdate ( element )) {
			parent.removeChild ( element );
			this._afterUpdate ( parent );
			this._report ();
		}
	},
	
	/**
	 * Report.
	 * TODO: Push to update manager.
	 */
	_report : function () {
		this._super._report ( "edb.RemoveUpdate #" + this.id );
	}
});


/**
 * Updating the functions it is.
 * @TODO: revoke all functions in context on window.unload (if portalled)
 */
edb.FunctionUpdate = edb.Update.extend ({

	/**
	 * Update type.
	 * @type {String}
	 */
	type : edb.Update.TYPE_FUNCTION,

	/**
	 * Setup update.
	 * @param {String} id
	 * @param @optional {Map<String,String>} map
	 */
	setup : function ( id, map ) {
		this.id = id;
		this._map = map || null;
		return this;
	},

	/**
	 * Do the update.
	 */
	update : function () {
		var count = 0, elm = this.element ();
		if ( this._map ) {
			if (( count = edb.FunctionUpdate._remap ( elm, this._map ))) {
				this._report ( "remapped " + count + " keys" );
			}
		} else {
			if (( count = edb.FunctionUpdate._revoke ( elm ))) {
				this._report ( "revoked " + count + " keys" );
			}
		}
	},

	/**
	 * Report the update.
	 * @param {String} report
	 */
	_report : function ( report ) {
		this._super._report ( "edb.FunctionUpdate " + report );
	}

}, { // Static ......................................................

	/**
	 * @param {Element} element
	 */
	_revoke : function ( element ) {
		var count = 0, keys;
		this._getatts ( element ).forEach ( function ( att ) {
			keys = gui.KeyMaster.extractKey ( att.value );
			if ( keys ) {
				keys.forEach ( function ( key ) {
					edb.Script.$revoke ( key );
					count ++;
				});
			}
		});
		return count;
	},

	/**
	 * @param {Element} element
	 * @param {Map<String,String>} map
	 */
	_remap : function ( element, map ) {
		var count = 0, oldkeys, newkey;
		if ( Object.keys ( map ).length ) {
			this._getatts ( element ).forEach ( function ( att ) {
				if (( oldkeys = gui.KeyMaster.extractKey ( att.value ))) {
					oldkeys.forEach ( function ( oldkey ) {
						if (( newkey = map [ oldkey ])) {
							att.value = att.value.replace ( oldkey, newkey );
							edb.Script.$revoke ( oldkey );
							count ++;
						}
					});
				}
			});
		}
		return count;
	},

	/**
	 * Collect attributes from DOM subtree that 
	 * somewhat resemble EDBML poke statements.
	 * @returns {Array<Attribute>}
	 */
	_getatts : function ( element ) {
		var atts = [];
		new gui.Crawler ().descend ( element, {
			handleElement : function ( elm ) {
				Array.forEach ( elm.attributes, function ( att ) {
					if ( att.value.contains ( "edb.go" )) {
						atts.push ( att );
					}
				});
			}
		});
		return atts;
	}

});


/*
 * Register module.
 */
edb.EDBModule = gui.module ( "edb@wunderbyte.com", {
	
	/**
	 * CSS selector for currently focused form field.
	 * @TODO: Support links and buttons as well
	 * @type {String}
	 */
	fieldselector : null,

	/*
	 * Extending {gui.Spirit}
	 */
	mixins : {

		/**
		 * @TODO: support accessor and implement as property
		 * @param {String|function} script
		 */
		src : function ( script ) {
			if ( gui.Type.isString ( script )) {
				script = gui.Object.lookup ( script );	
			}
			if ( gui.Type.isFunction ( script )) {
				this.script.load ( script );
			} else {
				throw new TypeError ();
			}
		},
		
		/**
		 * Called whenever the EDBML script was evaluated.
		 * @param {TODOTHING} summary
		 */
		onrender : function ( summary ) {},

		/**
		 * Handle changes.
		 * @param {Array<edb.ObjectChange|edb.ArrayChange>}
		 */
		onchange : function ( changes ) {},

		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {},

		/**
		 * Handle directed input. Setup to require 
		 * the input listener be to be added first.
		 * @see {edb.InputPlugin}
		 * @TODO: when to destruct the type?
		 */
		$oninput : function ( input ) {
			this.script.input.match ( input );
		}
	},
	
	/*
	 * Register default plugins for all spirits.
	 */
	plugins : {
		script : edb.ScriptPlugin,
		input : edb.InputPlugin,
		output : edb.OutputPlugin
	},

	/*
	 * Channeling spirits to CSS selectors.
	 */
	channels : [
		[ ".gui-script", "edb.ScriptSpirit" ]
	],
	
	/* 
	 * @param {Window} context
	 */
	oncontextinitialize : function ( context ) {
		var plugin, proto, method;
		/*
		 * @TODO: Nasty hack to circumvent that we 
		 * hardcode "event" into inline poke events, 
		 * this creates an undesired global variable.
		 */
		if ( !context.event ) {
			try {
				context.event = null;
			} catch ( ieexception ) {}
		}
		if ( !context.gui.portalled ) {
			if (( plugin = context.gui.AttConfigPlugin )) {
				proto = plugin.prototype;
				method = proto.$evaluate;
				proto.$evaluate = function ( name, value, fix ) {
					if ( gui.Type.isString ( value ) && value.startsWith ( "edb.get" )) {
						var key = gui.KeyMaster.extractKey ( value )[ 0 ];
						value = key ? context.edb.get ( key ) : key;
					}
					return method.call ( this, name, value, fix );
				};
			}
		}
	},

	/**
	 * Context spiritualized.
	 * @param {Window} context
	 */
	onafterspiritualize : function ( context ) {
		var doc = context.document;
		if ( gui.Client.isGecko ) { // @TODO: patch in Spiritual?
			doc.addEventListener ( "focus", this, true );
			doc.addEventListener ( "blur", this, true );
		} else {
			doc.addEventListener ( "focusin", this, true );
			doc.addEventListener ( "focusout", this, true );
		}
		
	},

	/**
	 * Handle event.
	 * @param {Event} e
	 */
	handleEvent : function ( e ) {
		switch ( e.type ) {
			case "focusin" :
			case "focus" :
				this.fieldselector = this._fieldselector ( e.target );
				break;
			case "focusout" :
			case "blur" :
				this.fieldselector = null;
				break;
		}
	},


	// Private ...................................................

	/**
	 * Compute selector for form field. We scope it to 
	 * nearest element ID or fallback to document body.
	 * @param {Element} element
	 */
	_fieldselector : function ( elm ) {
		var index = -1;
		var parts = [];
		function hasid ( elm ) {
			if ( elm.id ) {
				try {
					gui.DOMPlugin.q ( elm.parentNode, elm.id );
					return true;
				} catch ( malformedexception ) {}
			}
			return false;
		}
		while ( elm && elm.nodeType === Node.ELEMENT_NODE ) {
			if ( hasid ( elm )) {
				parts.push ( "#" + elm.id );
				elm = null;
			} else {
				if ( elm.localName === "body" ) {
					parts.push ( "body" );
					elm = null;
				} else {
					index = gui.DOMPlugin.ordinal ( elm ) + 1;
					parts.push ( ">" + elm.localName + ":nth-child(" + index + ")" );
					elm = elm.parentNode;
				}
			}
		}
		return parts.reverse ().join ( "" );
	}

});


}( this ));