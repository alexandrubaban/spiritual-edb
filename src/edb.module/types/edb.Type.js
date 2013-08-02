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
	 * 
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