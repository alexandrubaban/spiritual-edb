/*
 * Spiritual EDB 0.0.2
 * (c) 2013 Wunderbyte
 * Spiritual is freely distributable under the MIT license.
 */



/*
 * Namepace object.
 */
window.edb = gui.namespace ( "edb", {
	
	/**
	 * Although it should probably be false until we have full support...
	 * @type {boolean}
	 */
	portals : true,

	/**
	 * Mount compiled functions as blob files 
	 * (if at all supported) to aid debugging?
	 * @type {boolean}
	 */
	useblobs : true, // @TODO: somehow map to local gui.debug

	/**
	 * Constants.
	 */
	BROADCAST_ACCESS : "edb-broadcast-access",
	BROADCAST_CHANGE : "edb-broadcast-change",
	BROADCAST_OUTPUT : "edb-broadcast-output",
	BROADCAST_SCRIPT_INVOKE : "edb-broadcast-script-invoke",
	LIFE_SCRIPT_WILL_RUN : "edb-life-script-will-run",
	LIFE_SCRIPT_DID_RUN : "edb-life-script-did-run",
	TICK_SCRIPT_UPDATE : "edb-tick-script-update",
	TICK_COLLECT_INPUT : "edb-tick-collect-input",
	TICK_PUBLISH_CHANGES : "edb-tick-update-changes",

	/**
	 * Register action to execute later.
	 * @param {function} action
	 * @param {object} thisp
	 * @returns {function}
	 */
	set : function ( action, thisp ) {
		return edb.Script.$assign ( action, thisp );
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
		edb.Script.$invoke ( key, sig, this._log );
	}
	
});



/**
 * Mixin methods and properties common to both {edb.Object} and {edb.Array}
 */
edb.Type = function () {};
edb.Type.prototype = {
	
	/**
	 * Resource ID (serverside or localstorage key).
	 * @type {String}
	 */
	$id : null,

	/**
	 * Experimental.
	 * @type {String}
	 */
	$contextid : null,
		
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
	 * @TODO instead use $onconstruct consistantly throughout types?
	 */
	onconstruct : function () {},
	
	/**
	 * Serialize to JSON string without private and expando properties.
	 * @todo Declare $normalize as a method stub here (and stull work in subclass)
	 * @param {function} filter
	 * @param {String|number} tabber
	 * @returns {String}
	 */
	$stringify : function ( filter, tabber ) {
		return JSON.stringify ( this.$normalize (), filter, tabber );
	},

	/**
	 * Use some kind of factory pattern.
	 */
	$get : function () {
		throw new Error ( "Not supported. Use " + this.constructor + ".$get(optionalid)" );
	},

	/**
	 * PUT resource.
	 * @param @optional {Map<String,object>} options
	 * @returns {gui.Then}
	 */
	$put : function ( options ) {
		return this.constructor.put ( this, options );
	},

	/**
	 * POST resource.
	 * @param @optional {Map<String,object>} options
	 * @returns {gui.Then}
	 */
	$post : function ( options ) {
		return this.constructor.post ( this, options );
	},

	/**
	 * DELETE resource.
	 * @param @optional {Map<String,object>} options
	 * @returns {gui.Then}
	 */
	$delete : function ( options ) {
		return this.constructor.del ( this, options );
	}
};


// Static .......................................................................

gui.Object.each ({ // injecting static methods

	/*
	 * Dispatch a getter broadcast before base function.
	 */
	getter : gui.Combo.before ( function () {
		gui.Broadcast.dispatchGlobal ( this, edb.BROADCAST_ACCESS, this._instanceid );
	}),

	/*
	 * Dispatch a setter broadcast after base function.
	 */
	setter : gui.Combo.after ( function () {
		gui.Broadcast.dispatchGlobal ( this, edb.BROADCAST_CHANGE, this._instanceid );
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
	 * Is inst of {edb.Object} or {edb.Array}?
	 * @param {object} o
	 * @returns {boolean}
	 */
	isInstance : function ( o ) {
		if ( gui.Type.isComplex ( o )) {
			return ( o instanceof edb.Object ) || ( o instanceof edb.Array );
		}
		return false;
	},

	/**
	 * Lookup edb.Type constructor for argument (if not already an edb.Type).
	 * @TODO Confirm that it is actually an edb.Type thing...
	 * @param {Window|WebWorkerGlobalScope} arg
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
		if ( gui.Type.isComplex ( value ) && !edb.Type.isInstance ( value )) {
			switch ( gui.Type.of ( value )) {
				case "object" :
					return new edb.Object ( value );
				case "array" :
					return new edb.Array ( value );
			}
		} 
		return value;
	}

}, function ( key, value ) {
	edb.Type [ key ] = value;
});


// REST mappings ......................................................................

/*
 * TODO: gui.Class mechanism for mixins on recurring static fields :)
 */
gui.Object.each ({ // injecting static methods

	/**
	 * Resource URI.
	 * @type {String}
	 */
	uri : null,

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
	get : function () {
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
		this.request ( href, "GET", null, function ( response ) {
			then.now ( type.response ( response ));
		});
		return then;
	},

	/**
	 * PUT resource.
	 * @param {edb.Object|edb.Array} inst
	 * @param @optional {Map<String,object>} options
	 * @param {String} $method (Framework internal)
	 * @returns {gui.Then}
	 */
	put : function ( inst, options, $method ) {
		var type = this;
		var then = new gui.Then ();
		var href = gui.URL.parametrize ( inst.uri, options );
		var data = gui.Type.isInstance ( inst ) ? inst.$normalize () : inst;
		this.request ( href, $method || "PUT", data, function ( response ) {
			then.now ( type.response ( response, options, $method ));
		});
		return then;
	},

	/**
	 * POST resource.
	 * @param {edb.Object|edb.Array} inst
	 * @param @optional {Map<String,object>} options
	 * @param {String} $method (Framework internal)
	 * @returns {gui.Then}
	 */
	post : function ( inst, options ) {
		return this.put ( inst, options, "POST" );
	},

	/**
	 * DELETE resource ("delete" being a reserved keyword).
	 * @param {edb.Object|edb.Array} inst
	 * @param @optional {Map<String,object>} options
	 * @param {String} $method (Framework internal)
	 * @returns {gui.Then}
	 */
	del : function ( inst, options ) {
		return this.put ( inst, options, "DELETE" );
	},

	/**
	 * Performs the request. Perhaps you would like to overwrite this method.
	 * @TODO: Somehow handle HTTP status codes.
	 * @param {String} url
	 * @param {String} method
	 * @param {object} payload
	 * @param {function} callback
	 */
	request : function ( url, method, payload, callback ) {
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
	response : function ( response, options, method ) {
		var Type = this;
		switch ( gui.Type.of ( response )) {
			case "object" :
			case "array" :
				response = new Type ( response );
				break;
		}
		return response;
	}

}, function ( key, value ) {
	edb.Type [ key ] = value;
});


/**
 * edb.Object
 * @extends {edb.Type}
 */
edb.Object = gui.Class.create ( Object.prototype, {
	
	/**
	 * Construct edb.Object with optional data.
	 * @param @optional {object|edb.Object} data
	 */
	$onconstruct : function ( data ) {
		edb.Type.underscoreinstanceid ( this ); // iOS bug...
		switch ( gui.Type.of ( data )) {
			case "object" : 
			case "undefined" :
				edb.Object._approximate ( this, data || Object.create ( null ));
				break;
			default :
				throw new TypeError ( 
					"Unexpected argument of type " + 
					gui.Type.of ( data )
				);
		}
		this.onconstruct.apply ( this, arguments ); // @TODO do we wan't this?
	},

	/**
	 * Create clone of this object filtering out 
	 * underscore and dollar prefixed properties. 
	 * Recursively normalizing nested EDB types.
	 * @returns {object}
	 */
	$normalize : function () {
		var c, o = {};
		gui.Object.each ( this, function ( key, value ) {
			c = key [ 0 ];
			if ( c !== "$" && c !== "_" && edb.Type.isInstance ( value  )) {
				value = value.$normalize ();
			}
			o [ key ] = value;
		});
		return o;
	}


}, { // Recurring static ............................................................
	
	/**
	 * Resource URI.
	 * @type {String}
	 */
	uri : null,

	/**
	 * GET resource.
	 * @param {String} id
	 * @param @optional {Map<String,object>} options
	 * @returns {edb.Object|edb.Array}
	 */
	get : edb.Type.get,

	/**
	 * PUT resource.
	 * @param {edb.Object|edb.Array} inst
	 * @param @optional {Map<String,object>} options
	 * @returns {object}
	 */
	put : edb.Type.put,

	/**
	 * POST resource.
	 * @param {edb.Object|edb.Array} inst
	 * @param @optional {Map<String,object>} options
	 * @returns {object}
	 */
	post : edb.Type.post,

	/**
	 * DELETE resource.
	 * @param {edb.Object|edb.Array} inst
	 * @param @optional {Map<String,object>} options
	 * @returns {object}
	 */
	del : edb.Type.del,

	/**
	 * Performs the request.
	 * @param {String} url
	 * @param {String} method
	 * @param {object} payload
	 * @param {function} callback
	 */
	request : edb.Type.request,

	/**
	 * Formats the reponse.
	 * @param {object} response
	 * @returns {object}
	 */
	response : edb.Type.response


}, { // Static ......................................................................

	/**
	 * TODO
	 * @param {edb.Object} object
	 * @param {edb.IChangeHandler} handler
	 * @returns {edb.Object}
	 */
	observe : function ( object, handler ) {
		var id = object.$instanceid || object._instanceid;
		var obs = this._observers;
		var handlers = obs [ id ] || ( obs [ id ] = []);
		if ( handlers.indexOf ( handler ) === -1 ) {
			handlers.push ( handler );
		}
		return object;
	},

	/**
	 * TODO
	 * @param {edb.Object} object
	 * @param {edb.IChangeHandler} handler
	 * @returns {edb.Object}
	 */
	unobserve : function ( object, handler ) {
		var id = object.$instanceid || object._instanceid;
		var obs = this._observers;
		var index, handlers = obs [ id ];
		if ( handlers ) {
			if (( index = handlers.indexOf ( handler )) >-1 ) {
				if ( gui.Array.remove ( handlers, index ) === 0	) {
					delete obs [ id ];
				}
			}
		}
		return object;
	},

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
				gui.Broadcast.dispatchGlobal ( null, edb.BROADCAST_CHANGE, instanceid ); // @TODO deprecate
			});
		}
	},


	// Private static ....................................................................

	/**
	 * Object observers.
	 * @type {}
	 */
	_observers : Object.create ( null ),

	/**
	 * Create getter for key.
	 * @param {String} key
	 * @param {function} base
	 * @returns {function}
	 */
	_getter : function ( key, base ) {
		return function () {
			var result = base.apply ( this );
			edb.Object._onaccess ( this, key );
			return result;
		};
	},

	/**
	 * Create setter for key.
	 * @param {String} key
	 * @param {function} base
	 * @returns {function}
	 */
	_setter : function ( key, base ) {
		return function ( newval ) {
			var oldval = this [ key ]; // @TODO suspend something?
			base.apply ( this, arguments );
			edb.Object._onchange ( this, key, oldval, newval );
			oldval = newval;
		};
	},

	/**
	 * Primarily for iternal use: Publish a notification on property 
	 * accessors so that {edb.Script} may register change observers.
	 * @param {String} instanceid
	 * @param {edb.ObjectAccess} access
	 */
	_onaccess : function ( object, name ) {
		var access = new edb.ObjectAccess ( object, name );
		gui.Broadcast.dispatchGlobal ( null, edb.BROADCAST_ACCESS, access.instanceid );
	},

	/**
	 * Register change summary for publication in next tick.
	 * @param {edb.Object} object
	 * @param {String} name
	 * @param {object} oldval
	 * @param {object} newval
	 */
	_onchange : function ( object, name, oldval, newval ) {
		var all = this._changes, id = object._instanceid;
		var set = all [ id ] = all [ id ] || ( all [ id ] = Object.create ( null ));
		set [ name ] = new edb.ObjectChange ( object, name, edb.ObjectChange.TYPE_UPDATED, oldval, newval );
		gui.Tick.dispatch ( edb.TICK_PUBLISH_CHANGES );
	},

	/**
	 * Mapping instanceids to maps that map property names to change summaries.
	 * @type {Map<String,Map<String,edb.ObjectChange>>}
	 */
	_changes : Object.create ( null ),

	/**
	 * Servers two purposes:
	 * 
	 * 1. Simplistic proxy mechanism to dispatch {gui.Type} broadcasts on object setters and getters. 
	 * 2. Supporting model hierarchy unfolding be newing up all that can be indentified as constructors.
	 * 
	 * @param {edb.Object} handler The edb.Object instance that intercepts properties
	 * @param {object} proxy The object whose properties are being intercepted (the JSON object)
	 */
	_approximate : function ( handler, proxy ) {
		var Def, def, types = Object.create ( null );
		this._definitions ( handler ).forEach ( function ( key ) {
			def = handler [ key ];
			if ( gui.Type.isComplex ( def )) {
				if ( gui.Type.isConstructor ( def )) {
					Def = def;
					types [ key ] = new Def ( proxy [ key ]);
				} else {
					types [ key ] = edb.Type.cast ( def );
				}
			} else if ( !gui.Type.isDefined ( proxy [ key ])) {
				proxy [ key ] = handler [ key ];
			}
		});
		/* 
		 * Setup property accessors for handler.
		 *
		 * 1. Objects by default convert to edb.Object
		 * 2. Arrays by default convert to edb.Array
		 * 3. Simple properties get proxy accessors
		 */
		gui.Object.nonmethods ( proxy ).forEach ( function ( key ) {
			def = proxy [ key ];
			if ( gui.Type.isComplex ( def ) && !types [ key ]) {
				types [ key ] = edb.Type.cast ( def );
			}
			gui.Property.accessor ( handler, key, {
				getter : edb.Object._getter ( key, function () {
					return types [ key ] || proxy [ key ];
				}),
				setter : edb.Object._setter ( key, function ( value ) {
					/*
					 * TODO: when resetting array, make sure that 
					 * it becomes xx.MyArray (not plain edb.Array)
					 */
					var target = types [ key ] ? types : proxy;
					target [ key ] = edb.Type.cast ( value );
				})
			});
		});
	},

	/**
	 * List non-private fields names from handler that are not 
	 * mixed in from {edb.Type} and not inherited from Object.
	 * @param {edb.Object} handler
	 * @returns {Array<String>}
	 */
	_definitions : function ( handler ) {
		var keys = [];
		gui.Object.all ( handler, function ( key ) {
			if ( !gui.Type.isDefined ( Object.prototype [ key ])) {
				if ( !gui.Type.isDefined ( edb.Type.prototype [ key ])) {
					if ( !key.startsWith ( "_" )) {
						keys.push ( key );
					}
				}
			}	
		});
		return keys;
	}
});

/*
 * Mixin methods and properties common 
 * to both {edb.Object} and {edb.Array}
 */
( function setup () {
	gui.Tick.add ( edb.TICK_PUBLISH_CHANGES, edb.Object );
	gui.Object.extendmissing ( edb.Object.prototype, edb.Type.prototype );
}());



/**
 * @using {Array.prototype}
 */
( function using ( proto ) {

	/**
	 * edb.Array
	 * @extends {edb.Type} ...although not really...
	 */
	edb.Array = gui.Class.create ( proto, {

		
		// Overrides ...........................................................................
		
		/**
		 * Push.
		 */
		push : function() {
			var res = proto.push.apply ( this, arguments );
			Array.forEach ( arguments, function ( arg ) {
				edb.Array._onchange ( this, 1, arg );
			}, this );
			return res;
		},
		
		/**
		 * Pop.
		 */
		pop : function () {
			var res = proto.pop.apply ( this, arguments );
			edb.Array._onchange ( this, 0, res );
			return res;
		},
		
		/**
		 * Shift.
		 */
		shift : function () {
			var res = proto.shift.apply ( this, arguments );
			edb.Array._onchange ( this, 0, res );
			return res;
		},

		/**
		 * Unshift.
		 */
		unshift : function () {
			var res = proto.unshift.apply ( this, arguments );
			Array.forEach ( arguments, function ( arg ) {
				edb.Array._onchange ( this, 1, arg );
			}, this );
			return res;
		},

		/**
		 * Splice.
		 */
		splice : function () {
			var res = proto.splice.apply ( this, arguments );
			var add = [].slice.call ( arguments, 2 );
			res.forEach ( function ( r ) {
				edb.Array._onchange ( this, 0, r );
			}, this );
			add.forEach ( function ( a ) {
				edb.Array._onchange ( this, 1, a );
			}, this );
			return res;
		},


		// Custom ..............................................................................

		/**
		 * The content type can be declared as:
		 *
		 * 1. An edb.Type constructor function (my.ns.MyType)
		 * 2. A filter function to accept JSON (for analysis) and return an edb.Type constructor.
		 * @type {function} Type constructor or filter function
		 */
		$of : null,

		/**
		 * Secret constructor.
		 */
		$onconstruct : function () {
			edb.Type.underscoreinstanceid ( this ); // iOS bug...
			edb.Array.populate ( this, arguments );
			edb.Array.approximate ( this );
			this.onconstruct.call ( this, arguments );
		},

		/**
		 * Create true array without expando properties, recursively normalizing nested EDB 
		 * types. Returns the type of array we would typically transmit back to the server. 
		 * @returns {Array}
		 */
		$normalize : function () {
			return Array.map ( this, function ( thing ) {
				if ( edb.Type.isInstance ( thing )) {
					return thing.$normalize ();
				}
				return thing;
			});
		}
		
		
	}, { // Recurring static ...............................................................

		/**
		 * Resource URI.
		 * @type {String}
		 */
		uri : null,


		/**
		 * Experimental.
		 * @type {String|function}
		 */
		persist : null,

		/**
		 * GET resource.
		 * @param {String} id
		 * @param @optional {Map<String,object>} options
		 * @returns {edb.Object|edb.Array}
		 */
		get : edb.Type.get,

		/**
		 * PUT resource.
		 * @param {edb.Object|edb.Array} inst
		 * @param @optional {Map<String,object>} options
		 * @returns {object}
		 */
		put : edb.Type.put,

		/**
		 * POST resource.
		 * @param {edb.Object|edb.Array} inst
		 * @param @optional {Map<String,object>} options
		 * @returns {object}
		 */
		post : edb.Type.post,

		/**
		 * DELETE resource.
		 * @param {edb.Object|edb.Array} inst
		 * @param @optional {Map<String,object>} options
		 * @returns {object}
		 */
		del : edb.Type.del,

		/**
		 * Performs the request.
		 * @param {String} url
		 * @param {String} method
		 * @param {object} payload
		 * @param {function} callback
		 */
		request : edb.Type.request,

		/**
		 * Formats the reponse.
		 * @param {object} response
		 * @returns {object}
		 */
		response : edb.Type.response


	}, { // Static ..............................................................

		/**
		 * Populate {edb.Array} from constructor arguments.
		 *
		 * 1. Populate as normal array, one member for each argument
		 * 2. If the first argument is an array, populate using this.
		 *
		 * For case number two, we ignore the remaining arguments. 
		 * @TODO read something about http://www.2ality.com/2011/08/spreading.html
		 * @param {edb.Array}
		 * @param {Arguments} args
		 */
		populate : function ( array, args ) {
			var members;
			if ( args.length ) {
				members = [];
				if ( gui.Type.isArray ( args [ 0 ])) {
					members = args [ 0 ];
				} else {
					members = Array.prototype.slice.call ( args );
				}
				if ( gui.Type.isFunction ( array.$of )) {
					members = edb.Array._populatefunction ( members, array.$of );
				} else {
					members = edb.Array._populatedefault ( members );
				}
				Array.prototype.push.apply ( array, members );
			}
		},

		/**
		 * Simplistic proxy mechanism. 
		 * @param {object} handler The object that intercepts properties (the edb.Array)
		 * @param {object} proxy The object whose properties are being intercepted (raw JSON data)
		 */
		approximate : function ( handler, proxy ) {
			var def = null;
			proxy = proxy || Object.create ( null );	
			this._definitions ( handler ).forEach ( function ( key ) {
				def = handler [ key ];
				switch ( gui.Type.of ( def )) {
					case "function" :
						break;
					case "object" :
					case "array" :
						console.warn ( "TODO: complex stuff on edb.Array :)" );
						break;
					default :
						if ( !gui.Type.isDefined ( proxy [ key ])) {
							proxy [ key ] = handler [ key ];
						}
						break;
				}
			});
			
			/* 
			 * Handler intercepts all accessors for simple properties.
			 */
			gui.Object.nonmethods ( proxy ).forEach ( function ( key ) {
				Object.defineProperty ( handler, key, {
					enumerable : true,
					configurable : true,
					get : edb.Type.getter ( function () {
						return proxy [ key ];
					}),
					set : edb.Type.setter ( function ( value ) {
						proxy [ key ] = value;
					})
				});
			});
		},


		// Private static .........................................................

		/**
		 * Collect list of definitions to transfer from proxy to handler.
		 * @param {object} handler
		 * @returns {Array<String>}
		 */
		_definitions : function ( handler ) {
			var keys = [];
			for ( var key in handler ) {
				if ( this._define ( key )) {
					keys.push ( key );
				}
			}
			return keys;
		},

		/**
		 * Should define given property?
		 * @param {String} key
		 * @returns {boolean}
		 */
		_define : function ( key ) {
			if ( !gui.Type.isNumber ( gui.Type.cast ( key ))) {
				if ( !gui.Type.isDefined ( Array.prototype [ key ])) {
					if ( !gui.Type.isDefined ( edb.Type.prototype [ key ])) {
						if ( !key.startsWith ( "_" )) {
							return true;
						}
					}
				}
			}
			return false;
		},

		/**
		 * Parse field declared via constructor or via 
		 * filter function (which returns a constructor).
		 */
		_populatefunction : function ( members, func ) {
			return members.map ( function ( o ) {
				if ( o !== undefined && !o._instanceid ) {
					var Type = func;
					if ( !gui.Type.isConstructor ( Type )) {
						Type = func ( o );
					}
					o = new Type ( o );
				}
				return o;
			});
		},

		/**
		 * Parse field default. Objects and arrays automatically  
		 * converts to instances of {edb.Object} and {edb.Array}
		 */
		_populatedefault : function ( members ) {
			return members.map ( function ( o ) {
				if ( !edb.Type.isInstance ( o )) {
					switch ( gui.Type.of ( o )) {
						case "object" : 
							return new edb.Object ( o );
						case "array" :
							return new edb.Array ( o );
					}
				}
				return o;
			});
		},

		/**
		 * TODO.
		 * @param {edb.Array} array
		 */
		_onaccess : function ( array ) {},

		/**
		 * Register change summary for publication in next tick.
		 * @param {edb.Array} array
		 * @param {number} type
		 * @param {object} item
		 */
		_onchange : function ( array, type, item ) {
			type = {
				0 : edb.ArrayChange.TYPE_REMOVED,
				1 : edb.ArrayChange.TYPE_ADDED
			}[ type ];
			// console.log ( array, type, item ); TODO :)
		}

	});

}( Array.prototype ));

/*
 * Overloading array methods.
 * @using {edb.Array.prototype}
 */
( function using ( proto ) {

	"use strict";

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
	
	/*
	 * TODO: This is wrong on so many...
	 * @param {edb.Array} other
	 */
	proto.concat = function ( other ) {
		var clone = new this.constructor (); // must not construct() the instance!
		this.forEach ( function ( o ) {
			clone.push ( o );
		});
		other.forEach ( function ( o ) {
			clone.push ( o );
		});
		return clone;
	};

	// @TODO "sort", "reverse", "join"
	
}( edb.Array.prototype ));

/*
 * Mixin methods and properties common 
 * to both {edb.Object} and {edb.Array}
 */
( function setup () {
	// TODO gui.Tick.add ( edb.TICK_PUBLISH_CHANGES, edb.Array );
	gui.Object.extend ( edb.Array.prototype, edb.Type.prototype );
}());



/**
 * @param {edb.Type} type
 * @param {String} name
 */
edb.ObjectAccess = function ( object, name ) {
	this.instanceid = object._instanceid;
	this.object = object;
	this.name = name;
};

edb.ObjectAccess.prototype = {
	instanceid : null,
	object : null,
	name : null
};


/**
 * edb.Object change summary.
 * @param {edb.Object} object
 * @param {String} name
 * @param {String} type
 * @param {object} oldval
 * @param {object} newval
 */
edb.ObjectChange = function ( object, name, type, oldval, newval ) {
	//this.instanceid = object._instanceid;
	this.object = object;
	this.name = name;
	this.type = type;
	this.oldValue = oldval;
	this.newValue = newval;
};

edb.ObjectChange.prototype = {
	//instanceid : null,
	object: null,
	name: null,
	type: null,
	oldValue: undefined,
	newValue: undefined
};

/**
 * We only support type "updated" until 
 * native 'Object.observe' comes along.
 * @type {String}
 */
edb.ObjectChange.TYPE_UPDATED = "updated";


/**
 * @param {edb.Array} array
 */
edb.ArrayAccess = function ( array ) {
	this.instanceid = array._instanceid;
	this.array = array;
};

edb.ArrayAccess.prototype = {
	instanceid : null,
	array : null
};


/**
 * @param {edb.Array} array
 */
edb.ArrayChange = function ( array ) {
	this.instanceid = array._instanceid;
};

edb.ArrayChange.prototype = {
	instanceid : null,
	array : null
};

edb.ArrayChange.TYPE_ADDED = "added";
edb.ArrayChange.TYPE_REMOVED = "removed";


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


/**
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
		return edb.Output.dispatch ( this.context, data, Type );
	},

	/**
	 * Given Type has been output already?
	 * @param {edb.Object|edb.Array} Type
	 * @returns {boolean}
	 */
	exists : function ( Type ) {
		return edb.Output.exists ( this.context, Type );
	}

});


/**
 * EDB input.
 * @param {object} data
 * @param {function} type
 */
edb.Input = function Input ( type, data ) {
	this.type = type || null;
	this.data = data || null;
};

edb.Input.prototype = {
	
	/**
	 * Input type (function constructor)
	 * @type {function}
	 */
	type : null,
	
	/**
	 * Input data (instance of this.type)
	 * @type {object|edb.Type} data
	 */
	data : null,
	
	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Input]";
	}
};

/**
 * Format data as an {edb.Type} and wrap it in an {edb.Input}.
 * TODO: Support non-automated casting to edb.Object and edb.Array (raw JSON)?
 * @param {Window|WebWorkerGlobalScope} context
 * @param {object|Array|edb.Input} data
 * @param @optional {function|String} Type
 * @returns {edb.Input}
 */
edb.Input.format = function ( context, data, Type ) {
	if ( data instanceof edb.Input === false ) {
		if ( Type ) {
			Type = edb.Type.lookup ( context, Type );
			if ( data instanceof Type === false ) {
				data = new Type ( data );
			}
		} else if ( !data._instanceid ) { // TODO: THE WEAKNESS
			switch ( gui.Type.of ( data )) {
				case "object" :
					Type = edb.Object.extend ();
					break;
				case "array" :
					Type = edb.Array.extend ();
					break;
			}
			data = this.format ( data, Type );
		} else {
			Type = data.constructor;
		}
		data = new edb.Input ( Type, data ); // data.constructor?
	}
	return data;
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
		this._watches = [];
		this._matches = [];
	},

	/**
	 * Destruction time.
	 */
	ondestruct : function () {
		this._super.ondestruct ();
		this.remove ( this._watches );
		this._xxx ( false );
	},
	
	/**
	 * Add handler for one or more input types.
	 * @param {edb.Type|String|Array<edb.Type|String>} arg 
	 * @param @optional {object} IInputHandler Defaults to this.spirit
	 * @returns {gui.InputPlugin}
	 */
	add : gui.Combo.chained ( function ( arg, handler ) {
		this.done = false;
		handler = handler ? handler : this.spirit;
		arg = edb.InputPlugin._breakdown ( arg, this.context );
		this._add ( arg, handler );
		this._xxx ( true );
	}),

	/**
	 * Remove handler for one or more input types.
	 * @TODO Cleanup more stuff?
	 * @param {edb.Type|String|Array<edb.Type|String>} arg 
	 * @param @optional {object} handler implements InputListener (defaults to this)
	 * @returns {gui.InputPlugin}
	 */
	remove : gui.Combo.chained ( function ( arg, handler ) {
		handler = handler ? handler : this.spirit;
		arg = edb.InputPlugin._breakdown ( arg, this.context );
		this._remove ( arg, handler );
		if (( this.done = this._matches.length === this._watches.length )) { // right?
			this._xxx ( false );
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
	 * Dispatch private data. Only the associated {edb.Script} can see this!
	 * @TODO the dispatching spirit should be able to intercept this as well...
	 * @param {object} data JSON object or array (demands arg 2) or an edb.Type instance (omit arg 2).
	 * @param @optional {function|String} type edb.Type constructor or "my.ns.MyType"
	 * @returns {edb.Object|edb.Array}
	 */
	dispatch : function ( data, Type ) {
		if ( this.spirit ) {
			return this.spirit.script.input ( data, Type );
		} else {
			console.error ( "TODO: not implemented (private sandbox input)" );
		}
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
		this._maybeinput ( input );
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
	 * Add input handler for types.
	 * @TODO Are we sure that tick works synch in all browsers 
	 * (FF)? If not, better to wait for this.spirit.life.ready
	 * @param {Array<function>} types
	 * @param {IInputHandler} handler
	 */
	_add : function ( types, handler ) {
		types.forEach ( function ( Type ) {
			if ( gui.Type.isDefined ( Type )) {
				this._watches.push ( Type );
				this._addchecks ( Type.$classid, [ handler ]);
				if ( edb.Output.exists ( this.context, Type )) { // type has been output already?
					// alert ( edb.Output.$get ( this.context, Type ));

					this._maybeinput ( edb.Output.$get ( this.context, Type ));
					/*
					 * TODO: this tick was needed at some point (perhaps in Spiritual Dox?)
					 */
					// gui.Tick.next(function(){ // allow nested {edb.ScriptSpirit} to spiritualize first
						//this._todoname ();
					// }, this );

				}
			} else {
				throw new TypeError ( "Could not register input for undefined Type" );
			}
		}, this );
	},

	/**
	 * Remove input handler for types.
	 * @param {Array<function>} types
	 * @param {IInputHandler} handler
	 */
	_remove : function ( types, handler ) {
		types.forEach ( function ( type ) {
			var index = this._watches.indexOf ( type );
			if ( index >-1 ) {
				this._watches.remove ( index );
				this._removechecks ( type.$classid, [ handler ]);
			}
		}, this );
	},


	/**
	_todoname : function () {
		this._watches.forEach ( function ( Type ) {
			if ( edb.Output.exists ( Type, this.context )) {
				this._maybeinput ( edb.Output.get ( Type, this.context ));
			}
		}, this );
	},
	*/

	/*
	 * TODO: Comment goes here.
	 *
	_todoname : function () {
		this._watches.forEach ( function ( type ) {
			if ( type.output instanceof edb.Input ) {
				this._maybeinput ( type.output );
			}
		}, this );
	},
	*/



	/**
	 * If input matches registered type, update handlers.
	 * @param {edb.Input} input
	 */
	_maybeinput : function ( input ) {
		var best = edb.InputPlugin._bestmatch ( input.type, this._watches );
		if ( best ) {
			this._updatematch ( input );
			this.done = this._matches.length === this._watches.length;
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
		var keys = gui.Class.ancestorsAndSelf ( input.type, function ( Type ) {
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
	 * @param {boolean} is
	 */
	_xxx : function ( is ) {
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
 * @extends {gui.Plugin} (should perhaps extend some kind of genericscriptplugin)
 */
edb.ScriptPlugin = gui.Plugin.extend ({

	/**
	 * Script has been loaded and compiled?
	 * @type {boolean}
	 */
	loaded : false,

	/**
	 * Automatically run the script on spirit.onenter()? 
	 * @TODO implement 'required' attribute on params instead...
	 *
	 * - any added <?param?> value will be undefined at this point
	 * - adding <?input?> will delay run until all input is loaded
	 * @type {boolean}
	 */
	autorun : true,

	/**
	 * Script has been run? Flipped after first run.
	 * @type {boolean}
	 */
	ran : false,

	/**
	 * Use minimal updates (let's explain exactly what this is)?
	 * If false, we write the entire HTML subtree on all updates. 
	 * @type {boolean}
	 */
	diff : true,

	/**
	 * Log development stuff to console?
	 * @type {boolean}
	 */
	debug : false,

	/**
	 * Hm...
	 * @type {Map<String,object>}
	 */
	extras : null,

	/**
	 * Script SRC. Perhaps this should be implemented as a method.
	 * @type {String}
	 */
	src : {
		getter : function () {
			return this._src;
		},
		setter : function ( src ) {
			this.load ( src );
		}
	},
	
	/**
	 * Construction time.
	 *
	 * 1. don't autorun service scripts
	 * 2. use minimal updating system?
	 * 3. import script on startup 
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		var spirit = this.spirit;
		this.inputs = this.inputs.bind ( this );
		spirit.life.add ( gui.LIFE_DESTRUCT, this );
		if ( spirit instanceof edb.ScriptSpirit ) {
			this.autorun = false;
		} else if ( this.diff ) {
			this._updater = new edb.UpdateManager ( spirit );
		}
	},

	/**
	 * Destruction time.
	 */
	ondestruct : function () {
		this._super.ondestruct ();
		if ( this._script ) {
			this._script.dispose ();
		}
	},

	/**
	 * Handle attribute update.
	 * @param {gui.Att} att
	 */
	onatt : function ( att ) {
		if ( att.name === "src" ) {
			this.src = att.value;
		}
	},

	/**
	 * If in an iframe, now is the time to fit the iframe 
	 * to potential new content (emulating seamless iframes).
	 * @TODO: at least make sure IframeSpirit consumes this if not set to fit
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {
		if ( tick.type === gui.TICK_DOC_FIT ) {
			this.spirit.action.dispatchGlobal ( gui.ACTION_DOC_FIT );
		}
	},
	
	/**
	 * @TODO: The issue here is that the {ui.UpdateManager} can't diff propertly unless we 
	 * wait for enter because it looks up the spirit via {gui.Spiritual#_spirits.inside}...
	 * @param {gui.Life} life
	 */
	onlife : function ( life ) {
		if ( life.type ===  gui.LIFE_ENTER ) {
			this.spirit.life.remove ( life.type, this );
			if ( this._dosrc ) {
				this.load ( this._dosrc );
				this._dosrc = null;
			}
		}
	},

	/**
	 * Load script from SRC. This happens async unless the SRC 
	 * points to a script embedded in the spirits own document 
	 * (and unless script has already been loaded into context).
	 * @param {String} src (directives resolved on target SCRIPT)
	 */
	load : function ( src ) {
		var win = this.context;
		var doc = win.document;
		var abs = gui.URL.absolute ( doc, src );
		if ( this.spirit.life.entered ) {
			if ( abs !== this._src ) {
				edb.Script.load ( win, doc, src, function onreadystatechange ( script ) {
					this._onreadystatechange ( script );
				}, this );
				this._src = abs;
			}
		} else { // {edb.UpdateManager} needs to diff
			this.spirit.life.add ( gui.LIFE_ENTER, this );
			this._dosrc = src;
		}
	},

	/**
	 * Compile script from source TEXT and run it when ready.
	 * @param {String} source Script source code
	 * @param @optional {HashMap<String,object>} directives Optional compiler directives
	 */
	compile : function ( source, directives ) {
		var win = this.context, url = new gui.URL ( this.context.document );
		edb.Script.compile ( win, url, source, directives, function onreadystatechange ( script ) {
			this._onreadystatechange ( script );
		}, this );
	},

	/**
	 * Run script (with implicit arguments) and write result to DOM.
	 * @see {gui.SandBoxView#render}
	 */
	run : function ( /* arguments */ ) {
		if ( this.loaded ) {
			this._script.pointer = this.spirit; // TODO!
			this.write ( 
				this._script.execute.apply ( 
					this._script, 
					arguments 
				)	
			);
		} else {
			this._dorun = arguments;
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
				if ( this.diff ) {
					this._updater.update ( html );
				} else {
					this.spirit.dom.html ( html ); // TODO: forms markup make valid!
				}
			});
			this.ran = true;
			this.spirit.life.dispatch ( 
				edb.LIFE_SCRIPT_DID_RUN, changed // @TODO Support this kind of arg...
			);
			if ( this.context.gui.hosted ) { // fit any containing iframe in next tick.
				var tick = gui.TICK_DOC_FIT;
				var id = this.context.gui.$contextid;
				gui.Tick.one ( tick, this, id ).dispatch ( tick, 0, id );
			}
		}
	},

	/**
	 * Private input for this script only.
	 * @see {edb.InputPlugin#dispatch}
	 * @param {object} data JSON object or array (demands arg 2) or an edb.Type instance (omit arg 2).
	 * @param @optional {function|String} type edb.Type constructor or "my.ns.MyType"
	 * @returns {edb.Object|edb.Array}
	 */
	input : function ( data, Type ) {
		var input = edb.Input.format ( this.context, data, Type );
		if ( this._script ) {
			this._script.input.match ( input );
		} else {
			this._doinput = this._doinput || [];
			this._doinput.push ( input );
		}
		return input.data;
	},

	/**
	 * Return data for input of type.
	 * @param {function} type
	 * @returns {object}
	 */
	inputs : function ( type ) {
		return this._script.input.get ( type );
	},


	// PRIVATES ...........................................................................

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

	/*
	 * Listing private input to be injected into script once loaded.
	 * @type {Array<edb.Input>}
	 */
	_doinput : null,

	/**
	 * @type {String}
	 */
	_dosrc : null,

	/**
	 * Run arguments on script loaded.
	 * @type {Arguments}
	 */
	_dorun : null,

	/**
	 * Snapshot latest HTML to avoid parsing duplicates.
	 * @type {String}
	 */
	_html : null,

	/**
	 * Handle script state change.
	 * @param {edb.Script} script
	 */
	_onreadystatechange : function ( script ) {
		this._script = this._script || script;
		switch ( script.readyState ) {
			case edb.Function.WAITING :
				if ( this._doinput ) {
					if ( this._doinput.length ) { // strange bug...
						while ( this._doinput.length ) {
							this.input ( this._doinput.shift ());
						}
						this._doinput = null;
					}
				}
				break;
			case edb.Function.READY :
				if ( !this.loaded ) {
					this.loaded = true;
					if ( this.debug ) {
						script.debug ();
					}
				}
				if ( this._dorun ) {
					this.run.apply ( this, this._dorun );
					this._dorun = null;
				} else if ( this.autorun ) {
					this.run (); // @TODO: only if an when entered!
				}
				break;
		}
	},

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
					this._debugwarning ();
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
	 * TODO: STACK LOST ANYWAY!
	 * @type {String}
	 */
	_warning : "Spiritual: Form elements with a unique @id may be updated without losing the undo-redo stack (now gone)."

});


/**
 * Init parent spirit {edb.ScriptPlugin} if there is a parent spirit. 
 * When the parent spirit runs the script, this spirit will destruct.
 */
edb.ScriptSpirit = gui.Spirit.extend ({

	/**
	 * Log compiled source to console?
	 * @type {boolean}
	 */
	debug : false,

	/**
	 * Hello.
	 */
	onconfigure : function () {
		this._super.onconfigure ();
		var parent = this.dom.parent ( gui.Spirit );
		if ( parent ) {
			this._initparentplugin ( parent );
		}
	},
	
	
	// Private .....................................................................

	/**
	 * Init {edb.ScriptPlugin} in parent spirit.
	 * @param {gui.Spirit} parent
	 */
	_initparentplugin : function ( parent ) {
		var src = this.att.get ( "src" );
		if ( src ) {
			parent.script.load ( src ); // diretives resolved from target script element
		} else {
			var directives = this.att.getmap ();
			directives.debug = directives.debug || this.debug;
			parent.script.compile ( this.dom.text (), directives );
		}
	}

});



/**
 * Spirit of the data service.
 * @see http://wiki.whatwg.org/wiki/ServiceRelExtension
 */
edb.ServiceSpirit = gui.Spirit.extend ({
	
	/**
	 * Default to accept JSON and fetch data immediately.
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		var type = this.att.get ( "type" );
		if ( type ) {
			var Type = gui.Object.lookup ( type, this.window );
			if ( Type ) {
				if ( this.att.get ( "href" )) {
					new gui.Request ( this.element.href ).get ().then ( function ( status, data ) {
						this.output.dispatch ( new Type ( data ));
					}, this );
				} else {
					this.output.dispatch ( new Type ());
				}
			} else {
				throw new TypeError ( "\"" + type + "\" is not a Type (in this context)." );	
			}
		} else {
			throw new Error ( "TODO: formalize missing type somehow" );
		}
	}

	// /**
	//  * TODO: enable this pipeline stuff
	//  * @param {edb.Input} input
	//  */
	// oninput : function ( input ) {
	// 	this._super.oninput ( input );
	// 	if ( this.att.get ( "type" ) && this.input.done ) {
	// 		this._pipeline ();
	// 	}
	// },
	
	// PRIVATES ...............................................................................................
	
	/**
	 * If both input type and output type is specified, the service will automatically output new data when all 
	 * input is recieved. Input data will be supplied as constructor argument to output function; if A and B is 
	 * input types while C is output type, then input instance a and b will be output as new C ( a, b ) 
	 * @TODO Implement support for this some day :)
	 *
	_pipeline : function () {		
		console.error ( "TODO: might this be outdated???" );
		 *
		 * TODO: use method apply with array-like arguments substitute pending universal browser support.
		 * https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/apply#Description
		 *
		var data = new this.output._type (
			this._arg ( 0 ),
			this._arg ( 1 ),
			this._arg ( 2 ),
			this._arg ( 3 ),
			this._arg ( 4 ),
			this._arg ( 5 ),
			this._arg ( 6 ),
			this._arg ( 7 ),
			this._arg ( 8 ),
			this._arg ( 9 )
		);
		this.output.dispatch ( data );
	},
	
	 *
	 * Return data for index. Index follows the order of which the input handler was added, not in which data was recieved. 
	 * Alright, so this implies that first index will return object of type MyData if handler for this type was added first.
	 * @param {number} index
	 * @returns {object}
	 *
	_arg : function ( index ) {
		var type = this.input._types [ index ]; // function type
		return this.input.get ( type ); // instance of function
	}
	*/
});


/**
 * EDB processing instruction.
 * @TODO Problem with one-letter variable names in <?input name="a" type="TestData"?>
 * @param {String} pi
 */
edb.Instruction = function ( pi ) {
	this.atts = Object.create ( null );
	this.type = pi.split ( "<?" )[ 1 ].split ( " " )[ 0 ]; // TODO: regexp this
	var hit, atexp = edb.Instruction._ATEXP;
	while (( hit = atexp.exec ( pi ))) {
		var n = hit [ 1 ], v = hit [ 2 ];
		this.atts [ n ] = gui.Type.cast ( v );
	}
};

/**
 * Identification.
 * @returns {String}
 */
edb.Instruction.prototype = {
	type : null, // instruction type
	atts : null, // instruction attributes
	toString : function () {
		return "[object edb.Instruction]";
	}
};


// STATICS .............................................................................

/**
 * Extract processing instructions from source.
 * @param {String} source
 * @returns {Array<edb.Instruction>}
 */
edb.Instruction.from = function ( source ) {
	var pis = [], pi = null, hit = null; 
	while (( hit = this._PIEXP.exec ( source ))) {
			pis.push ( new edb.Instruction ( hit [ 0 ]));
	}
	return pis;
};

/**
 * Remove processing instructions from source.
 * @param {String} source
 * @returns {String}
 */
edb.Instruction.clean = function ( source ) {
	return source.replace ( this._PIEXP, "" );
};

/**
 * Math processing instruction.
 * @type {RegExp}
 */
edb.Instruction._PIEXP = /<\?.[^>?]+\?>/g;

/**
 * Match attribute name and value.
 * @type {RegExp}
 */
edb.Instruction._ATEXP = /(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/g;


/**
 * Script runner.
 */
edb.Runner = function Runner () {};

edb.Runner.prototype = {

	firstline : false,
	lastline : false,
	firstchar : false,
	lastchar : false,

	/**
	 * Run script.
	 * @param {edb.Compiler} compiler
	 * @param {String} script
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	run : function ( compiler, script, status, result ) {
		this._runlines ( compiler, script.split ( "\n" ), status, result );
	},

	/**
	 * Line text ahead equals given string?
	 * @param {String} string
	 * @returns {boolean}
	 */
	ahead : function ( string ) {
		var line = this._line;
		var index = this._index;
		var i = index + 1;
		var l = string.length;
		return line.length > index + l && line.substring ( i, i + l ) === string;
	},

	/**
	 * Line text behind equals given string?
	 * @param {String} line
	 * @param {number} index
	 * @param {String} string
	 * @returns {boolean}
	 */
	behind : function ( string ) {
		var line = this._line;
		var index = this._index;
		var length = string.length, start = index - length;
		return start >= 0 && line.substr ( start, length ) === string;
	},

	/**
	 * Get line string from current position.
	 * @returns {String}
	 */
	lineahead : function () {
		return this._line.substring ( this._index + 1 );
	},

	/**
	 * Space-stripped line text at index equals string?
	 * @param {String} string
	 * @returns {boolean}
	 */
	skipahead : function ( string ) {
		console.error ( "TODO" );
		/*
		line = line.substr ( index ).replace ( / /g, "" );
		return this._ahead ( line, 0, string );
		*/
	},

	// Private ..........................................................

	/**
	 * Current line string.
	 * @type {String}
	 */
	_line : null,

	/**
	 * Current character index.
	 * @type {number}
	 */
	_index : -1,

	/**
	 * Run all lines.
	 * @param {edb.Compiler} compiler
	 * @param {Array<String>} lines
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_runlines : function ( compiler, lines, status, result ) {
		var stop = lines.length - 1;
		lines.forEach ( function ( line, index ) {
			this.firstline = index === 0;
			this.lastline = index === stop;
			this._runline ( line, index, compiler, status, result );
		}, this );
	},

	/**
	 * Run single line.
	 * @param {String} line
	 * @param {number} index
	 * @param {edb.Compiler} compiler
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_runline : function ( line, index, compiler, status, result ) {
		line = this._line = line.trim ();
		if ( line.length ) {
			compiler.newline ( line, this, status, result );
			this._runchars ( compiler, line.split ( "" ), status, result );
			compiler.endline ( line, this, status, result );
		}
	},

	/**
	 * Run all chars.
	 * @param {edb.Compiler} compiler
	 * @param {Array<String>} chars
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_runchars : function ( compiler, chars, status, result ) {
		var stop = chars.length - 1;
		chars.forEach ( function ( c, i ) {
			this._index = i;
			this.firstchar = i === 0;
			this.lastchar = i === stop;
			compiler.nextchar ( c, this, status, result );
		}, this );
	}
};


/**
 * Stateful compiler stuff.
 * @param {String} body
 */
edb.Status = function Status () {
	this.conf = [];
};

// Static ....................................................

edb.Status.MODE_JS = "js";
edb.Status.MODE_HTML = "html";
edb.Status.MODE_TAG = "tag";

// Instance ..................................................

edb.Status.prototype = {
	mode : edb.Status.MODE_JS,
	peek : false,
	poke : false,
	cont : false,
	adds : false,
	func : null,
	conf : null,
	curl : null,
	skip : 0,
	last : 0,
	spot : 0,
	indx : 0,

	// tags
	refs : false, // pass by reference in tags

	/**
	 * Is JS mode?
	 * @returns {boolean}
	 */
	isjs : function () {
		return this.mode === edb.Status.MODE_JS;
	},

	/**
	 * Is HTML mode?
	 * @returns {boolean}
	 */
	ishtml : function () {
		return this.mode === edb.Status.MODE_HTML;
	},

	/**
	 * Is tag mode?
	 * @returns {boolean}
	 */
	istag : function () {
		return this.mode === edb.Status.MODE_TAG;
	},

	/**
	 * Go JS mode.
	 */
	gojs : function () {
		this.mode = edb.Status.MODE_JS;
	},

	/**
	 * Go HTML mode.
	 */
	gohtml : function () {
		this.mode = edb.Status.MODE_HTML;
	},

	/**
	 * Go tag mode.
	 */
	gotag : function () {
		this.mode = edb.Status.MODE_TAG;
	}
};


/**
 * Collecting compiler result.
 * @param @optional {String} body
 */
edb.Result = function Result ( body ) {
	this.body = body || "";
};

edb.Result.prototype = {

	/**
	 * Main result string.
	 * @type {String}
	 */
	body : null,

	/**
	 * Temp string buffer.
	 * @type {String}
	 */
	temp : null,

	/**
	 * Format result for readability.
	 * @returns {String}
	 */
	format : function () {
		return edb.Result.format ( this.body );
	}
};

/**
 * Format JS for readability.
 * @TODO Indent switch cases
 * @TODO Remove blank lines
 * @param {String} body
 * @returns {String}
 */
edb.Result.format = function ( body ) {
	var result = "",
		tabs = "\t",
		init = null,
		last = null,
		fixt = null,
		hack = null;
	body.split ( "\n" ).forEach ( function ( line ) {
		line = line.trim ();
		init = line.charAt ( 0 );
		last = line.charAt ( line.length - 1 );
		fixt = line.split ( "//" )[ 0 ].trim ();
		hack = fixt.charAt ( fixt.length - 1 );
		if (( init === "}" || init === "]" ) && tabs !== "" ) {				
			tabs = tabs.slice ( 0, -1 );
		}
		result += tabs + line + "\n";
		if ( last === "{" || last === "[" || hack === "{" || hack === "[" ) {
			tabs += "\t";
		}
	});
	return result;
};


/**
 * Core compiler business logic. This is where we parse the strings.
 */
edb.Compiler = gui.Class.create ( Object.prototype, {

	/**
	 * Line begins.
	 * @param {String} line
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	newline : function ( line, runner, status, result ) {
		status.last = line.length - 1;
		status.adds = line [ 0 ] === "+";
		status.cont = status.cont || ( status.ishtml () && status.adds );
	},

	/**
	 * Line ends.
	 * @param {String} line
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	endline : function  ( line, runner, status, result ) {
		if ( status.ishtml ()) {
			if ( !status.cont ) {
				result.body += "';\n";
				status.gojs ();
			}
		} else {
			result.body += "\n";
		}
		status.cont = false;
	},

	/**
	 * Next char.
	 * @param {String} c
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	nextchar : function ( c, runner, status, result ) {
		switch ( status.mode ) {
			case edb.Status.MODE_JS :
				this._compilejs ( c, runner, status, result );
				break;
			case edb.Status.MODE_HTML :
				this._compilehtml ( c, runner, status, result);
				break;
			case edb.Status.MODE_TAG :
				this._compiletag ( c, runner, status, result );
				break;
		}
		if ( status.skip-- <= 0 ) {
			if ( status.poke ) {
				result.temp += c;
			} else {
				if ( !status.istag ()) {
					result.body += c;
				}
			}
		}
	},


	// Private .....................................................
	
	/**
	 * Compile EDBML source to function body.
	 * @param {String} script
	 * @returns {String}
	 */
	_compile : function ( script ) {
		var runner = new edb.Runner (); 
		var status = new edb.Status ();
		var result = new edb.Result ( '"use strict";\n' );
		runner.run ( this, script, status, result );
		result.body += ( status.ishtml () ? "';" : "" ) + "\nreturn out.write ();";
		return result.format ();
	},

	/**
	 * Compile character as script.
	 * @param {String} c
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_compilejs : function ( c, runner, status, result ) {
		switch ( c ) {
			case "<" :
				if ( runner.firstchar ) {
					var line = "JSHINT";
					var i = "JSHINT";
					var tag;
					if ( false && ( tag = this._tagstart ( line ))) {
						status.gotag ();
						this._aaa ( status, line, i );
					} else if ( false && ( tag = this._tagstop ( line ))) {
						status.gotag (); // js?
						this._bbb ( status );
					} else {
						status.gohtml ();
						status.spot = result.body.length - 1;
						result.body += "out.html += '";
					}
				}
				break;
			case "@" :
				this._scriptatt ( runner, status, result );
				break;
		}
	},
	
	/**
	 * Compile character as HTML.
	 * @param {String} c
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_compilehtml : function ( c, runner, status, result ) {
		switch ( c ) {
			case "{" :
				if ( status.peek || status.poke ) {
					status.curl ++;
				}
				break;
			case "}" :
				if ( -- status.curl === 0 ) {
					if ( status.peek ) {
						status.peek = false;
						status.skip = 1;
						status.curl = 0;
						result.body += ") + '";
					}
					if ( status.poke ) {
						this._poke ( status, result );
						status.poke = false;
						result.temp = null;
						status.spot = -1;
						status.skip = 1;
						status.curl = 0;
					}
				}
				break;
			case "$" :
				if ( !status.peek && !status.poke && runner.ahead ( "{" )) {
					status.peek = true;
					status.skip = 2;
					status.curl = 0;
					result.body += "' + (";
				}
				break;
			case "#" :
				if ( !status.peek && !status.poke && runner.ahead ( "{" )) {
					status.poke = true;
					status.skip = 2;
					status.curl = 0;
					result.temp = "";
				}
				break;
			case "+" :
				if ( runner.firstchar ) {
					status.skip = status.adds ? 1 : 0;
				} else if ( runner.lastchar ) {
					status.cont = true;
					status.skip = 1;
				}
				break;
			case "'" :
				if ( !status.peek && !status.poke ) {
					result.body += "\\";
				}
				break;
			case "@" :
				this._htmlatt ( runner, status, result );
				break;
		}
	},

	/**
	 * Compile character as tag.
	 * @param {String} c
	 * @param {edb.Runner} runner
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_compiletag : function ( status, c, i, line ) {
		switch ( c ) {
			case "$" :
				if ( this._ahead ( line, i, "{" )) {
					status.refs = true;
					status.skip = 2;
				}
				break;
			case ">" :
				status.gojs ();
				status.skip = 1;
				break;
		}
	},

	/*
	 * Parse @ notation in JS.
	 * TODO: preserve email address and allow same-line @
	 * @param {String} line
	 * @param {number} i
	 */
	_scriptatt : function ( runner, status, result ) {
		var attr = edb.Compiler._ATTREXP;
		var rest, name;
		if ( runner.behind ( "@" )) {} 
		else if ( runner.ahead ( "@" )) {
			result.body += "var att = new edb.Att ();";
			status.skip = 2;
		} else {
			rest = runner.lineahead ();
			name = attr.exec ( rest )[ 0 ];
			if ( name ) {
				result.body += rest.replace ( name, "att['" + name + "']" );
				status.skip = rest.length;
			} else {
				throw "Bad @name: " + rest;
			}
		}
	},

	/*
	 * Parse @ notation in HTML.
	 * @param {String} line
	 * @param {number} i
	 */
	_htmlatt : function ( runner, status, result ) {
		var attr = edb.Compiler._ATTREXP;
		var rest, name, dels, what;
		if ( runner.behind ( "@" )) {}
		else if ( runner.behind ( "#{" )) { console.error ( "todo" );} // onclick="#{@passed}"
		else if ( runner.ahead ( "@" )) {
			result.body += "' + att._all () + '";
			status.skip = 2;
		} else {
			rest = runner.lineahead ();
			name = attr.exec ( rest )[ 0 ];
			dels = runner.behind ( "-" );
			what = dels ? "att._pop" : "att._out";
			result.body = dels ? result.body.substring ( 0, result.body.length - 1 ) : result.body;
			result.body += "' + " + what + " ( '" + name + "' ) + '";
			status.skip = name.length + 1;
		}
	},

	/**
	 * Generate poke at marked spot.
	 */
	_poke : function ( status, result ) {
		var sig = this._$contextid ? ( ", &quot;" + this._$contextid + "&quot;" ) : "";
		var body = result.body,
			temp = result.temp,
			spot = status.spot,
			prev = body.substring ( 0, spot ),
			next = body.substring ( spot ),
			name = gui.KeyMaster.generateKey ( "poke" );
		result.body = prev + "\n" + 
			"var " + name + " = edb.set ( function ( value, checked ) { \n" +
			temp + ";\n}, this );" + next +
			//"edb.Script.register ( event ).invoke ( &quot;\' + " + name + " + \'&quot;" + sig + " );";
			"edb.go(event,&quot;\' + " + name + " + \'&quot;" + sig + ");";
	}
	

	// TAGS .....................................................................

	/**
	 * Tag start?
	 * @param {String} line
	 *
	_tagstart : function ( line ) {
		return this._ahead ( line, 0, "ole" );
	},

	/**
	 * Tag stop?
	 * @param {String} line
	 *
	_tagstop : function ( line ) {
		return this._ahead ( line, 0, "/ole>" );
	},
	
	_aaa : function ( status, line, i ) {
		result.body += "out.html += Tag.get ( '#ole', window )( function ( out ) {";
		var elem = new gui.HTMLParser ( document ).parse ( line + "</ole>" )[ 0 ];
		var json = JSON.stringify ( gui.AttPlugin.getmap ( elem ), null, "\t" );
		var atts = this._fixerupper ( json );
		status.conf.push ( atts );
	},

	_bbb : function ( status ) {
		result.body += "}, " + status.conf.pop () + ");";
		status.conf = null;
	},

	_fixerupper : function ( json ) {

		var status = new edb.State ();
		result.body = "";


		var lines = json.split ( "\n" );
		lines.forEach ( function ( line, index ) {
			Array.forEach ( line, function ( c, i ) {
				switch ( c ) {
					case "\"" :
						if ( !status.peek && !status.poke ) {
							if ( this._ahead ( line, i, "${" )) {
								status.peek = true;
								status.skip = 3;
							} else if ( this._ahead ( line, i, "#{" )) {
								status.poke = true;
								status.skip = 3;
								result.temp = " function () {\n";
								status.spot = result.body.length - 1;
							}
						}
						break;
					case "}" :
						if ( status.peek || status.poke ) {
							if ( this._skipahead ( line, i, "\"" )) {
								if ( status.poke ) {
									result.temp += "\n}";
									result.body = result.body.substring ( 0, status.spot ) + 
									result.temp + result.body.substring ( status.spot );
								}
								status.peek = false;
								status.poke = false;
								status.skip = 2;
							}
						}
						break;
				}
				if ( status.skip-- <= 0 ) {
					if ( status.poke ) {
						result.temp += c;
					} else {
						result.body += c;
					}
				}
			}, this );
			if ( index < lines.length - 1 ) {
				result.body += "\n";
			}
		}, this );
		return result.body; //.replace ( /"\${/g, "" ).replace ( /\}"/g, "" );
	}
	*/


}, {}, { // Static ............................................................................

	/**
	 * Matches a qualified attribute name (class,id,src,href) allowing 
	 * underscores, dashes and dots while not starting with a number. 
	 * @TODO class and id may start with a number nowadays
	 * @TODO https://github.com/jshint/jshint/issues/383
	 * @type {RegExp}
	 */
	_ATTREXP : /^[^\d][a-zA-Z0-9-_\.]+/

});


/**
 * Compile EDB function.
 * @TODO precompiler to strip out both JS comments and HTML comments.
 */
edb.FunctionCompiler = edb.Compiler.extend ({

	/**
	 * Source of compiled function.
	 * @type {String}
	 */
	source : null,

	/**
	 * Imported functions and tags.
	 * @type {Array<edb.Import>}
	 */
	dependencies : null,

	/**
	 * Mapping script tag attributes.
	 * @type {HashMap<String,String>}
	 */
	directives : null,

	/**
	 * Compile sequence.
	 * @type {Array<string>}
	 */
	sequence : null,

	/**
	 * Construction.
	 * @param {String} source
	 * @param {Map<String,String} directives
	 */
	onconstruct : function ( source, directives ) {
		this.directives = directives || Object.create ( null );
		this.source = source;
		this.sequence = [ 
			"_validate", 
			"_extract", 
			"_direct", 
			"_declare", 
			"_define", 
			"_compile"
		];
	},
		
	/**
	 * Compile source to invocable function.
	 * @param {Window} context
	 * @param {Document} basedoc
	 * @returns {function}
	 */
	compile : function ( context, url ) {
		var result = null;
		this.dependencies = [];
		this._params = [];
		this._context = context;
		this._url = url;
		this._vars = [];
		var head = {
			declarations : Object.create ( null ), // Map<String,boolean>
			functiondefs : [] // Array<String>
		};
		this.sequence.forEach ( function ( step ) {
			this.source = this [ step ] ( this.source, head );
		}, this );
		try {
			result = this._convert ( this.source, this._params );
			this.source = this._source ( this.source, this._params );
		} catch ( exception ) {
			result = this._fail ( exception );
		}
		return result;
	},

	/**
	 * Sign generated methods with a gui.$contextid key. This allows us to evaluate assigned 
	 * functions in a context different to where the template HTML is used (sandbox scenario).
	 * @param {String} contextid
	 * @returns {edb.ScriptCompiler}
	 */
	sign : function ( contextid ) {
		this._$contextid = contextid;
		return this;
	},
	

	// PRIVATE ..............................................................................
	
	/**
	 * Function to be declared in this window (or worker scope).
	 * @type {Window}
	 */
	_context : null,

	/**
	 * (Optionally) stamp a $contextid into edb.ScriptCompiler.invoke() callbacks.
	 * @type {String} 
	 */
	_$contextid : null,

	/**
	 * Script processing intstructions.
	 * @type {Array<edb.Instruction>}
	 */
	_instructions : null,

	/**
	 * Compiled function arguments list. 
	 * @type {Array<String>}
	 */
	_params : null,

	/**
	 * Did compilation fail just yet?
	 * @type {boolean}
	 */
	_failed : false,

	/**
	 * Confirm no nested EDBML scripts because it's not parsable in the browser.
	 * @see http://stackoverflow.com/a/6322601
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_validate : function ( script ) {
		if ( edb.FunctionCompiler._NESTEXP.test ( script )) {
			throw "Nested EDBML dysfunction";
		}
		return script;
	},

	/**
	 * Handle directives. Nothing by default.
	 * @see {edb.TagCompiler._direct}
	 * @param  {String} script
	 * @returns {String}
	 */
	_direct : function ( script ) {
		return script;
	},
	
	/**
	 * Extract and evaluate processing instructions.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_extract : function ( script, head ) {
		edb.Instruction.from ( script ).forEach ( function ( pi ) {
			this._instruct ( pi );
		}, this );
		return edb.Instruction.clean ( script );
	},

	/**
	 * Evaluate processing instruction.
	 * @param {edb.Instruction} pi
	 */
	_instruct : function ( pi ) {
		var type = pi.type;
		var atts = pi.atts;
		var href = atts.src;
		var name = atts.name;
		var cont = this._context;
		switch ( type ) {
			case "param" :
				this._params.push ( name );
				break;
			case "function" :
			case "tag" :
				if ( type === edb.Import.TYPE_TAG ) {
					if ( href.contains ( "#" )) {
						name = href.split ( "#" )[ 1 ];
					} else {
						throw new Error ( "Missing tag #identifier: " + href );
					}
				}
				var base = this._basedocument ();
				this.dependencies.push ( 
					new edb.Import ( cont, base, type, href, name )
				);
				break;
		}
	},

	/**
	 * Remove processing instrutions and translate collected inputs to variable declarations.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_declare : function ( script, head ) {
		var funcs = [];
		this.dependencies.forEach ( function ( dep ) {
			head.declarations [ dep.name ] = true;
			funcs.push ( dep.name + " = get ( self, '" + dep.tempname () + "' );\n" );
		}, this );
		if ( funcs [ 0 ]) {
			head.functiondefs.push ( 
				"( function functions ( get ) {\n" +
				funcs.join ( "" ) +
				"}( edb.Function.get ));"
			);
		}
		return script;
	},

	/**
	 * Define more stuff in head.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_define : function ( script, head ) {
		var vars = "", html = "var ";
		Object.keys ( head.declarations ).forEach ( function ( name ) {
			vars += ", " + name;
		});
		if ( this._params.indexOf ( "out" ) < 0 ) {
			html += "Out = edb.Out, out = new Out (), ";
		}
		if ( this._params.indexOf ( "att" ) < 0 ) {
			html += "Att = edb.Att, att = new Att (), ";
		}
		html += "Tag = edb.Tag " + vars + ";\n";
		head.functiondefs.forEach ( function ( def ) {
			html += def +"\n";
		});
		return html + script;
	},
	
	/**
	 * Evaluate script to invocable function.
	 * @param {String} script
	 * @param @optional (Array<String>} params
	 * @returns {function}
	 */
	_convert : function ( script, params ) {
		var args = "", context = this._context;
		if ( gui.Type.isArray ( params )) {
			args = params.join ( "," );
		}
		return new context.Function ( args, script );
	},

	/**
	 * Compilation failed. Output a fallback rendering.
	 * @param {Error} exception
	 * @returns {function}
	 */
	_fail : function ( exception ) {
		var context = this._context;
		if ( !this._failed ) {
			this._failed = true;
			this._debug ( edb.Result.format ( this.source ));
			this.source = "<p class=\"error\">" + exception.message + "</p>";
			return this.compile ( context, true );
		} else {
			throw ( exception );
		}
	},
	
	/**
	 * Transfer broken script source to script element and import on page.
	 * Hopefully this will allow the developer console to aid in debugging.
	 * TODO: Fallback for IE9 (see http://stackoverflow.com/questions/7405345/data-uri-scheme-and-internet-explorer-9-errors)
	 * TODO: Migrate this stuff to the gui.BlobLoader
	 * @param {String} source
	 */
	_debug : function ( source ) {
		var context = this._context;
		if ( window.btoa ) {
			source = context.btoa ( "function debug () {\n" + source + "\n}" );
			var script = context.document.createElement ( "script" );
			script.src = "data:text/javascript;base64," + source;
			context.document.querySelector ( "head" ).appendChild ( script );
			script.onload = function () {
				this.parentNode.removeChild ( this );
			};
	  } else {
			// TODO: IE!
	  }
	},

	/**
	 * Compute full script source (including arguments) for debugging stuff.
	 * @returns {String}
	 */
	_source : function ( source, params ) {
		var lines = source.split ( "\n" ); lines.pop (); // empty line :/
		var args = params.length ? "( " + params.join ( ", " ) + " )" : "()";
		return "function " + args + " {\n" + lines.join ( "\n" ) + "\n}";
	},

	/**
	 * Base document to resolve relative URLs in templates. 
	 * @TODO: Works not in IE9, on the server or in workers.
	 */
	_basedocument : function () {
		return this._document || ( this._document = ( function ( href ) {
			var doc = document.implementation.createHTMLDocument ( "temp" );
	    var base = doc.createElement ( "base" );
			base.href = href;
			doc.querySelector ( "head" ).appendChild ( base );
			return doc;
		}( this._url.href )));
	}
	

}, {}, { // Static ............................................................................

	/**
	 * RegExp used to validate no nested scripts (because those are not parsable in the browser). 
	 * http://stackoverflow.com/questions/1441463/how-to-get-regex-to-match-multiple-script-tags
	 * http://stackoverflow.com/questions/1750567/regex-to-get-attributes-and-body-of-script-tags
	 * TODO: stress test for no SRC attribute!
	 * @type {RegExp}
	 */
	_NESTEXP : /<script.*type=["']?text\/edbml["']?.*>([\s\S]+?)/g

});


/**
 * Add support for data types.
 * @extends {edb.FunctionCompiler}
 */
edb.ScriptCompiler = edb.FunctionCompiler.extend ({

	/**
	 * Observed data types.
	 * @type {Map<String,String}
	 */
	inputs : null,

	/**
	 * Handle instruction.
	 */
	_instruct : function ( pi ) {
		this._super._instruct ( pi );
		var atts = pi.atts;
		switch ( pi.type ) {
			case "input" :
				this.inputs [ atts.name ] = atts.type;
				break;
		}
	},

	/**
	 * Compile script to invocable function.
	 * @param {Window} scope Function to be declared in scope of this window (or worker context).
	 * @param @optional {boolean} fallback
	 * @returns {function}
	 */
	compile : function ( context, url ) {
		this.inputs = Object.create ( null );
		return this._super.compile ( context, url );
	},

	/**
	 * Declare.
	 * @overrides {edb.FunctionCompiler} declare
	 * @param {String} script
	 * @returns {String}
	 */
	_declare : function ( script, head ) {
		this._super._declare ( script, head );
		return this._declareinputs ( script, head );
	},

	/**
	 * Declare inputs.
	 * @param {String} script
	 * @returns {String}
	 */
	_declareinputs : function ( script, head ) {
		var defs = [];
		gui.Object.each ( this.inputs, function ( name, type ) {
			head.declarations [ name ] = true;
			defs.push ( name + " = get ( " + type + " );\n" );
		}, this );
		if ( defs [ 0 ]) {
			head.functiondefs.push ( 
				"( function inputs ( get ) {\n" +
				defs.join ( "" ) +
				"})( this.script.inputs );" 
			);
		}
		return script;
	}

});


/**
 * Compile function as tag. Tags are functions with boilerplate code.
 * @extends {edb.FunctionCompiler}
 */
edb.TagCompiler = edb.FunctionCompiler.extend ({

	/**
	 * We added the "tag" directive ourselves.
	 * @overrides {edb.FunctionCompiler._direct}
	 * @param  {String} script
	 * @returns {String}
	 */
	_direct : function ( script ) {
		if ( this.directives.tag ) {
			var content = edb.TagCompiler._CONTENT;
			this._params.push ( "content" );
			this._params.push ( "attribs" );
			this._params.push ( "COMPILED_AS_TAG" );
			script = "att = new Att ( attribs );\n" + script;
			script = script.replace ( content, "content ( out );" );

		}
		return this._super._direct ( script );
	}


}, {}, { // Static .................................................

	/**
	 * Match <content/> tag in whatever awkward form.
	 * @type {RegExp}
	 */
	_CONTENT : /<content(.*)>(.*)<\/content>|<content(.*)(\/?)>/

});


/**
 * The function loader will fetch a function string from an external 
 * document or scan the local document for functions in SCRIPT tags.
 * @extends {gui.FileLoader}
 */
edb.Loader = gui.FileLoader.extend ({

	/**
	 * Mapping script element attributes to be used as compiler directives. 
	 * @type {Map<String,object>}
	 */
	directives : null,

	/**
	 * Load script source as text/plain.
	 * @overwrites {gui.FileLoader#load}
	 * @param {String} src
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	load : function ( src, callback, thisp ) {
		var url = new gui.URL ( this._document, src );
		if ( this._cache.has ( url.location )) {
			this._cached ( url, callback, thisp );
		} else if ( url.external ) {				
			this._request ( url, callback, thisp );
		} else if ( url.hash ) {
			this._lookup ( url, callback, thisp );
		} else {
			console.error ( "Now what?" );
		}
	},

	/**
	 * Handle loaded script source. Externally loaded file may contain multiple scripts.
	 * @overwrites {gui.FileLoader#onload}
	 * @param {String} text
	 * @param {gui.URL} url
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	onload : function ( text, url, callback, thisp ) {
		if ( url.external ) {
			text = this._extract ( text, url );
		}
		callback.call ( thisp, text, this.directives, url );
		this.directives = null;
	},
	

	// PRIVATES ........................................................................
	
	/**
	 * Lookup script in document DOM (as opposed to HTTP request).
	 * @param {gui.URL} url
	 * @param {Map<String,String>} cache
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	_lookup : function ( url, callback, thisp ) {
		var script = this._document.querySelector ( url.hash );
		if ( script ) {
			this.directives = gui.AttPlugin.getmap ( script );
			this.onload ( script.textContent, url, callback, thisp );
		} else {
			console.error ( "No such script: " + url );
		}
	},

	/**
	 * Templates are loaded as HTML documents with one or more script tags. 
	 * The requested script should have an @id to match the URL #hash.  
	 * If no hash was given, we return the source code of first script found.
	 * @param {String} text HTML with one or more script tags
	 * TODO: cache this stuff for repeated lookups!
	 * @param {gui.URL} url
	 * @returns {String} Template source code
	 */
	_extract : function ( text, url ) {
		var doc = gui.HTMLParser.parseToDocument ( text ); // @TODO: cache this
		var script = doc.querySelector ( url.hash || "script" );
		if ( script ) {	
			this.directives = gui.AttPlugin.getmap ( script );
			return script.textContent;
		} else {
			console.error ( "No such script: " + url.location + url.hash || "" );
		}
	}


});


/**
 * This fellow compiles an EDBML source string into an executable 
 * JS function. The onreadystatechange method fires when ready. 
 * The method "execute" may by then invoke the compiled function.
 */
edb.Function = gui.Class.create ( Object.prototype, {
	
	/**
	 * EDBML source compiled to executable JS function.
	 * @type {function}
	 */
	executable : null,

	/**
	 * Executable JS function compiled into this context.
	 * @type {Window|WebWorkerGlobalScope}
	 */
	context : null,

	/**
	 * Origin of the EDBML template (specifically in 'url.href')
	 * @type {gui.URL}
	 */
	url : null,

	/**
	 * Function may be executed when this switches to 'ready'. 
	 * You can overwrite the onreadystatechange method below.
	 * @type {String}
	 */
	readyState : null,
	
	/**
	 * Overwrite this to get notified on readyState changes. 
	 * The method recieves the {edb.Function} as an argument.
	 * @type {function}
	 */
	onreadystatechange : null,
	
	/**
	 * Construct.
	 * @param {Document} basedoc
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( context, url, handler ) {
		this.context = context || null;
		this.url = url || null;
		this.onreadystatechange = handler || null;
		this._imports = Object.create ( null );
	},
	
	/**
	 * Compile source to function.
	 *
	 * 1. Create the compiler (signed for sandbox usage)
	 * 2. Compile source to invokable function 
	 * 3. Preserve source for debugging
	 * 4. Copy expected params
	 * 5. Load required functions.
	 * 6. Report done whan all is loaded.
	 * @overwrites {edb.Template#compile}
	 * @param {String} source
	 * @param {HashMap<String,String>} directives
	 * @returns {edb.Function}
	 */
	compile : function ( source, directives ) { // @TODO gui.Combo.chained
		if ( this.executable === null ) {
			var Compiler = this._compiler ();
			var compiler = new Compiler ( source, directives );
			if ( this._$contextid ) {
				compiler.sign ( this._$contextid );
			}
			this.executable = compiler.compile ( this.context, this.url );
			this._source = compiler.source;
			this._dependencies ( compiler );
			this._oncompiled ( compiler, directives );
			return this;
		} else {
			throw new Error ( "TODO: recompile the script :)" );
		}
	},

	/**
	 * Log function source to console.
	 */
	debug : function () {
		console.debug ( this._source );
	},

	/**
	 * Resolve dependencies.
	 * @param {edb.Compiler} compiler
	 */
	_dependencies : function ( compiler ) {
		compiler.dependencies.map ( function ( dep ) {
			this._imports [ dep.name ] = null; // null all first
			return dep;
		}, this ).forEach ( function ( dep ) {
			dep.resolve ().then ( function ( resolved ) {
				this._imports [ dep.name ] = resolved;
				this._maybeready ();
			}, this );
		}, this );
	},

	/**
	 * Sign generated methods for sandbox scenario.
	 * @param {String} $contextid
	 * @returns {edb.Function}
	 */
	sign : function ( $contextid ) {
		this._$contextid = $contextid;
		return this;
	},
	
	/**
	 * Execute compiled function, most likely returning a HTML string.
	 * @returns {String} 
	 */
	execute : function ( /* arguments */ ) {
		var result = null;
		if ( this.executable ) {
			try {
				this._subscribe ( true );
				result = this.executable.apply ( this.pointer, arguments );
				this._subscribe ( false );
			} catch ( exception ) {
				console.error ( exception.message + ":\n\n" + this._source );
			}
		} else {
			throw new Error ( this + " not compiled" );
		}
		return result;
	},
	

	// PRIVATES ..........................................................................................
	
	/**
	 * Optionally stamp a $contextid into generated edb.Script.invoke() callbacks.
	 * @type {String} 
	 */
	_$contextid : null,

	/**
	 * Tracking imported functions.
	 * 
	 * 1. Mapping {edb.Import} instances while booting
	 * 2. Mapping {edb.Function} instances once resolved.
	 * @type {Map<String,edb.Import|function>}
	 */
	_imports : null,

	/**
	 * Get compiler implementation (subclass may overwrite this method).
	 * @returns {function}
	 */
	_compiler : function () {
		return edb.FunctionCompiler;
	},

	/**
	 * If supported, load invokable function 
	 * as blob file. Otherwise skip to init.
	 * @param {edb.FunctionCompiler} compiler
	 * @param {Map<String,String|number|boolean>} directives
	 */
	_oncompiled : function ( compiler, directives ) {
		if ( directives.debug ) {
			this.debug ();
		}
		try {
			if ( this._useblob ()) {
				this._loadblob ( compiler );
			} else {
				this._maybeready ();
			}
		} catch ( workerexception ) { // TODO: sandbox scenario
			this._maybeready ();
		}
	},

	/**
	 * Use blob files?
	 * @TODO: Investigate potential overheads and asyncness
	 */
	_useblob : function () {
		return this.context.edb.useblobs && 
			gui.Client.hasBlob && 
			!gui.Client.isExplorer && 
			!gui.Client.isOpera;
	},
	
	/**
	 * Mount compiled function as file. 
	 * @param {edb.Compiler} compiler
	 */
	_loadblob : function ( compiler ) {
		var win = this.context;
		var doc = win.document;
		var key = gui.KeyMaster.generateKey ();
		var src = compiler.source.replace ( "function", "function " + key );
		this._gostate ( edb.Function.LOADING );
		gui.BlobLoader.loadScript ( doc, src, function onload () {
			this._gostate ( edb.Function.WORKING );
			this.executable = win [ key ];
			this._maybeready ();
		}, this );
	},

	/**
	 * Update readystate and poke the statechange handler.
	 * @param {String} state
	 */
	_gostate : function ( state ) {
		if ( state !== this.readyState ) {
			this.readyState = state;
			if ( gui.Type.isFunction ( this.onreadystatechange )) {
				this.onreadystatechange ();
			}
		}
	},

	/**
	 * Report ready? Otherwise waiting 
	 * for data types to initialize...
	 */
	_maybeready : function () {
		if ( this.readyState !== edb.Function.LOADING ) {
			this._gostate ( edb.Function.WORKING );
			if ( this._done ()) {
				this._gostate ( edb.Function.READY );
			} else {
				this._gostate ( edb.Function.WAITING );
			}
		}
	},

	/**
	 * Ready to run?
	 * @returns {boolean}
	 */
	_done : function () {
		return Object.keys ( this._imports ).every ( function ( name ) {
			return this._imports [ name ] !== null;
		}, this );
	}


}, { // Recurring static ................................................

	/**
	 * Get function loaded from given SRC and compiled into given context.
	 * @param {Window} context
	 * @param {String} src
	 * @returns {function}
	 */
	get : function ( context, src ) {
		var ex = this._executables;
		var id = context.gui.$contextid;
		if ( gui.URL.absolute ( src )) {
			return ex [ id ] ? ex [ id ][ src ] || null : null;
		} else {
			throw new Error ( "Absolute URL expected" );
		}
	},

	/**
	 * Loaded and compile function for SRC. When compiled, you can 
	 * get the invokable function using 'edb.Function.get()' method. 
	 * @param {Window} context Compiler target context
	 * @param {Document} basedoc Used to resolve relative URLs
	 * @param {String} src Document URL to load and parse (use #hash to target a SCRIPT id)
	 * @param {function} callback
	 * @param {object} thisp
	 */
	load : function ( context, basedoc, src, callback, thisp ) {
		var exe = this._executablecontext ( context );
		new edb.Loader ( basedoc ).load ( src, function onload ( source, directives, url ) {
			this.compile ( context, url, source, directives, function onreadystatechange ( fun ) {
				if ( !exe [ url.href ] && fun.readyState === edb.Function.READY ) {
					exe [ url.href ] = fun.executable; // now avilable using edb.Function.get()
				}
				callback.call ( thisp, fun );
			});
		}, this );
	},

	/**
	 * Compile EDBML source to {edb.Function} instance in given context.
	 * @TODO: If <SCRIPT> has an id, we can store this in _executables...
	 * @param {Window} context
	 * @param {gui.URL} url
	 * @param {String} src
	 * @param {Map<String,String|number|boolean>} directives
	 * @param {function} callback
	 * @param {object} thisp
	 */
	compile : function ( context, url, source, directives, callback, thisp ) {
		var Fun = this, fun = new Fun ( context, url, function onreadystatechange () {
			callback.call ( thisp, this );
		}).compile ( source, directives );
	},


	// Private recurring static ..............................................................

	/**
	 * Mapping contextid to map that maps URIs to functions.
	 * @type {Map<String,Map<String,function>>}
	 */
	_executables : Object.create ( null ),

	/**
	 * Get (and possibly create) map for context.
	 * @param {Window} context
	 * @returns {Map<String,function>}
	 */
	_executablecontext : function ( context ) {
		var exe = this._executables, id = context.gui.$contextid;
		return exe [ id ] || ( exe [ id ] = Object.create ( null ));
	}


}, { // Static .............................................................................

	/**
	 * Function is loading.
	 * @type {String}
	 */
	LOADING : "loading",

	/**
	 * Function is waiting for something.
	 * @type {String}
	 */
	WAITING : "waiting",

	/**
	 * Function is processing something.
	 * @type {String}
	 */
	WORKING : "working",

	/**
	 * Function is ready to run.
	 * @type {String}
	 */
	READY : "ready"

});

/**
 * Allow function get to be thrown around. 
 * Might benefit some template readability.
 */
( function bind () {
	edb.Function.get = edb.Function.get.bind ( edb.Function );
}());


/**
 * EDB script.
 * @extends {edb.Function}
 */
edb.Script = edb.Function.extend ({

	/**
	 * Hijacking the {edb.InputPlugin} which has been 
	 * designed to work without an associated spirit.
	 * @type {edb.InputPlugin}
	 */
	input : null,

	/**
	 * Target for the "this" keyword in compiled script.
	 * @type {object}
	 */
	pointer : null,

	/**
	 * Construct.
	 * @poverloads {edb.Function#onconstruct}
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( context, url, handler ) {
		this._super.onconstruct ( context, url, handler );
		this.input = new edb.InputPlugin ();
		this.input.context = this.context; // as constructor arg?
		this.input.onconstruct (); // huh?
		console.warn ( "Bad: onconstruct should autoinvoke" );
		this._keys = new Set (); // tracking data changes

		// @TODO this *must* be added before it can be removed ?
		gui.Broadcast.addGlobal ( edb.BROADCAST_CHANGE, this );
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} broadcast
	 */
	onbroadcast : function ( b ) {
		switch ( b.type ) {
			case edb.BROADCAST_ACCESS :
				this._keys.add ( b.data );
				break;
			case edb.BROADCAST_CHANGE :
				if ( this._keys.has ( b.data )) {
					if ( this.readyState !== edb.Function.WAITING ) {
						var tick = edb.TICK_SCRIPT_UPDATE;
						var sig = this.context.gui.$contextid;
						gui.Tick.one ( tick, this, sig ).dispatch ( tick, 0, sig );	
						this._gostate ( edb.Function.WAITING );
					}
				}
				break;
		}
	},

	/**
	 * Handle tick.
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {
		switch ( tick.type ) {
			case edb.TICK_SCRIPT_UPDATE :
				this._gostate ( edb.Function.READY );
				break;
		}
	},

	/**
	 * Handle input.
	 * @param {edb.Input} input
	 */
	oninput : function ( input ) {
		this._maybeready (); // see {edb.Function} superclass
	},

	/**
	 * Execute the script, most likely returning a HTML string.
	 * @overrides {edb.Function#execute}
	 * @returns {String}
	 */
	execute : function () {
		this._keys = new Set ();
		var result = null;
		if ( this.input.done ) {
			this._subscribe ( true );
			result = this._super.execute.apply ( this, arguments );
			this._subscribe ( false );
		} else {
			 throw new Error ( "Script awaits input" );
		}
		return result;
	},

	/**
	 * Experimental...
	 */
	dispose : function () {
		this.onreadystatechange = null;
		this.input.ondestruct ();
	},


	// Private ............................................................

	/**
	 * Compiler implementation.
	 * @overwrites {edb.Function#_Compiler}
	 * @type {function}
	 */
	_Compiler : edb.ScriptCompiler,

	/**
	 * Tracking keys in edb.Type and edb.Array
	 * @type {Set<String>}
	 */
	_keys : null,

	/**
	 * Flipped when expected inputs have been determined.
	 * @type {boolean}
	 */
	_inputresolved : false,

	/**
	 * Get compiler implementation.
	 * @returns {function}
	 */
	_compiler : function () {
		return edb.ScriptCompiler;
	},

	/**
	 * Setup input listeners when compiled.
	 * @param {edb.ScriptCompiler} compiler
	 * @param {Map<String,String|number|boolean>} directives
	 * @overrides {edb.Function#_oncompiled}
	 */
	_oncompiled : function ( compiler, directives ) {
		gui.Object.each ( compiler.inputs, function ( name, type ) {
			this.input.add ( type, this );
		}, this );
		this._inputresolved = true;
		this._super._oncompiled ( compiler, directives );
	},

	/**
	 * Ready to run?
	 * @overrides {edb.Function#_done}
	 * @returns {boolean}
	 */
	_done : function () {
		return this._inputresolved && this.input.done && this._super._done ();
	},

	/**
	 * Add-remove broadcast handlers.
	 * @param {boolean} isBuilding
	 */
	_subscribe : function ( isBuilding ) {
		gui.Broadcast [ isBuilding ? "addGlobal" : "removeGlobal" ] ( edb.BROADCAST_ACCESS, this );
		gui.Broadcast [ isBuilding ? "removeGlobal" : "addGlobal" ] ( edb.BROADCAST_CHANGE, this );
	}


}, { // Recurring static .......................................................................
	
	/**
	 * @static
	 * Mapping compiled functions to keys.
	 * @type {Map<String,function>}
	 */
	_invokables : new Map (),

	/**
	 * Loggin event details.
	 * @type {Map<String,object>}
	 */
	_log : null,
	
	/**
	 * @static
	 * Map function to generated key and return the key.
	 * @param {function} func
	 * @param {object} thisp
	 * @returns {String}
	 */
	$assign : function ( func, thisp ) {
		var key = gui.KeyMaster.generateKey ();
		edb.Script._invokables.set ( key, function ( value, checked ) {
			func.apply ( thisp, [ gui.Type.cast ( value ), checked ]);
		});
		return key;
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
			if (( func = this._invokables.get ( key ))) {
				if ( log.type === "click" ) {
					setImmediate ( function () {
						func ( log.value, log.checked );
					});
				} else {
					func ( log.value, log.checked );
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
		this._log = {
			type : e.type,
			value : e.target.value,
			checked : e.target.checked
		};
		return this;
	}
	
});


/**
 * Here it is.
 * @extends {edb.Function}
 */
edb.Tag = edb.Function.extend ({

	/**
	 * Get compiler implementation.
	 * @returns {function}
	 */
	_compiler : function () {
		return edb.TagCompiler;
	},

	/**
	 * Adding the "tag" directive.
	 * @overrides {edb.Template#compile}
	 * @param {String} source
	 * @param {HashMap<String,String>} directives
	 * @returns {edb.Function}
	 */
	compile : function ( source, directives ) {
		directives.tag = true;
		return this._super.compile ( source, directives );
	}

});


/**
 * Tracking a single import (function dependency).
 * @param {Window} context Compiler target context
 * @param {Document} basedoc Resolving relative URLs
 * @param {String} type
 * @param {String} href
 * @param {String} name
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
	 * Where to lookup functions that may already be compiled?
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
	_context : null

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
		var type, html = "";
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
edb.Out = function Out () {

	this.html = "";
};

edb.Out.prototype = {

	/**
	 * HTML string (not well-formed while parsing).
	 * @type {String}
	 */
	html : null,

	/**
	 * Get HTML result. Do your output modification here.
	 * @returns {String}
	 */
	write : function () {
		return this.html;
	}
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
	 * Update.
	 * @param {String} html
	 */
	update : function ( html ) {
		this._updates = new edb.UpdateCollector ();
		if ( !this._olddom ) {
			this._first ( html );
		} else {
			this._next ( html );
		}
		this._updates.eachRelevant ( function ( update ) {
			update.update ();
			update.dispose ();
		});
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
		this._crawl ( this._newdom, this._olddom, this._newdom, this._keyid, {}, null );
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
	_crawl : function ( newchild, oldchild, lastnode, id, ids, css ) {
		var result = true, n = 1;
		while ( newchild && oldchild && !this._updates.hardupdates ( id )) {
			switch ( newchild.nodeType ) {
				case Node.TEXT_NODE :
					result = this._check ( newchild, oldchild, lastnode, id, ids, css, n );
					break;
				case Node.ELEMENT_NODE :
					result = this._scan ( newchild, oldchild, lastnode, id, ids, css, n );
					n ++;
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
	_scan : function ( newnode, oldnode, lastnode, id, ids, css, n ) {
		var result = true, oldid = this._assistant.id ( oldnode );
		css = css ? oldid ? "#" + oldid : css + ">" + oldnode.localName + ":nth-child(" + n + ")" : "this";
		if (( result = this._check ( newnode, oldnode, lastnode, id, ids, css, n )))  {	
			if ( oldid ) {
				ids = gui.Object.copy ( ids );
				lastnode = newnode;
				ids [ oldid ] = true;
				id = oldid;
			}
			result = this._crawl ( newnode.firstChild, oldnode.firstChild, lastnode, id, ids, css );
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
	_check : function ( newnode, oldnode, lastnode, id, ids, css, n ) {
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
						if (( result = this._checkatts ( newnode, oldnode, ids, css ))) {
							if ( this._maybesoft ( newnode, oldnode )) {
								if ( this._confirmsoft ( newnode, oldnode )) {
									this._updatesoft ( newnode, oldnode, ids, css, n );
									isSoftUpdate = true; // prevents the replace update
								}
								result = false; // crawling continued in _updatesoft
							} else {
								if ( oldnode.localName !== "textarea" ) { // TODO: better forms support!
									result = newnode.childNodes.length === oldnode.childNodes.length;
								}
							}
						}
					}
					break;
			}
		}
		if ( !result && !isSoftUpdate && !isPluginUpdate ) {
			this._updates.collect ( 
				new edb.HardUpdate ( this._doc ).setup ( id, lastnode )
			);
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
	_checkatts : function ( newnode, oldnode, ids, css ) {
		var result = true;
		var update = null;
		if ( this._attschanged ( newnode.attributes, oldnode.attributes, ids, css )) {
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
	 * @param {String} css
	 * @returns {boolean}
	 */
	_attschanged : function ( newatts, oldatts, ids, css ) {
		var changed = newatts.length !== oldatts.length;
		if ( !changed ) {
			changed = !Array.every ( newatts, function ischanged ( newatt ) {
				var oldatt = oldatts.getNamedItem ( newatt.name );
				return oldatt && oldatt.value === newatt.value;
			});
			if ( changed ) {
				changed = !Array.every ( newatts, function isfunctionchanged ( newatt ) {
					var oldatt = oldatts.getNamedItem ( newatt.name );
					var fnkeys = this._functionchanged ( newatt.value, oldatt.value );
					if ( fnkeys ) {
						this._changefunction ( ids, css, oldatt.name, fnkeys.newkey, fnkeys.oldkey );
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
		var newkey = gui.KeyMaster.extractKey ( newval ); // @TODO zero in keymaster
		var oldkey = gui.KeyMaster.extractKey ( oldval );
		if ( newkey && oldkey ) {
			return {
				newkey : newkey [ 0 ],
				oldkey : oldkey [ 0 ]
			};
		}
		return null;
	},

	_changefunction : function ( ids, css, oldname, newkey, oldkey ) {
		this._updates.collect ( new edb.FunctionUpdate ( this._doc ).setup ( 
			this._spirit, css, oldname, newkey, oldkey
		), ids );
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
	_updatesoft : function ( newnode, oldnode, ids, css, n ) {
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
			} else { // note that crawling continues here...
				var n1 = news [ id ];
				var n2 = olds [ id ];
				this._scan ( n1, n2, n1, id, ids, css, n );
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
	 * @returns {[type]}
	 */
	collect : function ( update, ids ) {
		this._updates.push ( update );
		if ( update.type === edb.Update.TYPE_HARD ) {
			this._hardupdates.add ( update.id );
		} else {
			update.ids = ids;
		}
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
	 * @returns {Element}
	 */
	element : function () {
		/*
		 * The root element (the one whose spirit is assigned the script) 
		 * may be indexed by "$instanceid" if no ID attribute is specified.
		 */
		var spirit, element = null;
		if ( gui.KeyMaster.isKey ( this.id )) {
			if (( spirit = this.window.gui.get ( this.id ))) {
				element = spirit.element;
			}
		} else {
			element = this.document.getElementById ( this.id );
		}
		if ( !element ) {
			console.error ( "No element to match @id: " + this.id );
			var all = this.window.gui._spirits.inside;
			Object.keys ( all ).forEach ( function ( key ) {
				var elm = all [ key ].element;
				console.debug ( key, elm.localName, elm.className );
			});
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
	
	
	// PRIVATE ...................................................................
	
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
		var event = "x-aftrerupdate-" + this.type;
		return this._dispatch ( element, event );
	},
	
	/**
	 * Dispatch bubbling DOM event for potential handlers to intercept the update.
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
		if ( this.window.gui.debug ) {
			if ( gui.KeyMaster.isKey ( this.id )) {
				report = report.replace ( this.id, "(anonymous)" );
			}
			console.debug ( report );
		}
	}
	

}, {}, { // Static .......................................................
	
	/**
	 * @static
	 * Default replace update. A section of the DOM tree is replaced. 
	 * {@see ReplaceUpdate}
	 * @type {String}
	 */
	TYPE_HARD : "hard",

	/**
	 * @static
	 * Attribute update. The element must have an ID specified.
	 * {@see UpdateManager#hasSoftAttributes}
	 * {@see AttributesUpdate}
	 * @type {String}
	 */
	TYPE_ATTS : "atts",

	/**
	 * @static
	 * Insertion update: Inserts a child without replacing the parent. Child 
	 * siblings must all be Elements and they must all have an ID specified.
	 * {@see SiblingUpdate}
	 * @type {String}
	 */
	TYPE_INSERT : "insert",

	/**
	 * @static
	 * TODO...
	 * {@see SiblingUpdate}
	 * @type {String}
	 */
	TYPE_APPEND : "append",

	/**
	 * @static
	 * Removal update: Removes a child without replacing the parent. Child 
	 * siblings must all be Elements and they must all have an ID specified.
	 * {@see SiblingUpdate}
	 * @type {String}
	 */
	TYPE_REMOVE : "remove",

	/**
	 * EDB function update.
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
			gui.DOMPlugin.html ( element, this._serialize ());
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
	 * Serialize XML element to XHTML string.
	 * TODO: Probably prefer DOM methods to innerHTML.
	 * @returns {String}
	 */
	_serialize : function () {
		var xhtml = new XMLSerializer ().serializeToString ( this.xelement );
		if ( xhtml.contains ( "</" )) {
			xhtml = xhtml.slice ( xhtml.indexOf ( ">" ) + 1, xhtml.lastIndexOf ( "<" ));
		}
		return xhtml;
	},
	
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
		temp.innerHTML = new XMLSerializer ().serializeToString ( this.xelement );
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
 * TODO: check if softupdate could mistarget the edb.FunctionUpdate.
 * TODO: move to updates folder.
 */
edb.FunctionUpdate = edb.Update.extend ({
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : "function",

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
	 * @param {gui.Spirit} spirit
	 * @param {String} selector
	 * @param {String} name
	 * @param {String} value
	 * @param {String} key
	 * @returns {edb.FunctionUpdate}
	 */
	setup : function ( spirit, selector, attname, newkey, oldkey ) {
		this._super.setup ();
		this._spirit = spirit;
		this._selector = selector;
		this._attname = attname;
		this._newkey = newkey;
		this._oldkey = oldkey;
		return this;
	},
	
	/**
	 * Update :)
	 */
	update : function () {
		this._super.update ();
		var element = null;
		try {
			element = this._spirit.dom.q ( this._selector );
		} catch ( domexception ) {
			throw new Error ( "Bad selector: " + this._selector );
		} finally {
			if ( element ) {
				if ( this._beforeUpdate ( element )) {
					this._update ( element, this._attname, this._newkey, this._oldkey );
					this._afterUpdate ( element );
					this._report ();
				}
			} else {
				throw new Error ( "No such element: " + this._selector );
			}
		} 
	},


	// PRIVATE ....................................................................
	
	/**
	 * Spirit who runs the EDB template (has the script element childnode).
	 * @type {[type]}
	 */
	_spirit : null,

	/**
	 * CSS selector to match the updated element.
	 * @type {String}
	 */
	_selector : null,

	/**
	 * Attribute name.
	 * @type {String}
	 */
	_attname : null,

	/**
	 * Old function lookup key.
	 * TODO: use this to garbage collect unusable assignments.
	 * @type {String}
	 */
	_oldkey : null,

	/**
	 * New function lookup key.
	 * @type {String}
	 */
	_newkey : null,

	/**
	 * Update element.
	 * @param {Element} element
	 */
	_update : function ( element, attname, newkey, oldkey ) {
		var newval, oldval = element.getAttribute ( attname );
		if ( oldval && oldval.contains ( oldkey )) {
			newval = oldval.replace ( oldkey, newkey );
			element.setAttribute ( attname, newval );
		} else {
			// perhaps there's an ID and we already performed an attribute update, could that be it?
			console.warn ( "Softupdate dysfunction or what?" );
		}
	},

	/**
	 * Debug changes.
	 */
	_report : function () {
		this._super._report ( "edb.FunctionUpdate " + this._selector );
	}

});


/*
 * Register module.
 */
window.edb.EDBModule = gui.module ( "edb", {
	
	/**
	 * CSS selector for currently focused form field.
	 * @TODO: Support links and buttons as well
	 * @TODO: Migrate to (future) EDBMLModule
	 * @type {String}
	 */
	fieldselector : null,

	/*
	 * Extending {gui.Spirit}
	 */
	mixins : {
		
		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {},

		/**
		 * Handle changes.
		 * @param {Array<edb.ObjectChange|edb.ArrayChange>}
		 */
		onchange : function ( changes ) {}
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
		[ "script[type='text/edbml']", "edb.ScriptSpirit" ],
		[ "link[rel='service']", "edb.ServiceSpirit" ]
	],

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
		while ( elm !== null ) {
			if ( hasid ( elm )) {
				parts.push ( "#" + elm.id );
				elm = null;
			} else {
				index = gui.DOMPlugin.ordinal ( elm ) + 1;
				parts.push ( ">" + elm.localName + ":nth-child(" + index + ")" );
				elm = elm.parentNode;
			}
		}
		return parts.reverse ().join ( "" );
	}

});