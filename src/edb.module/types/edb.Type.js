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
	 * Store resource.
	 * @param {Map<String,String|number|boolean>} options
	 */
	$save : function ( options ) {
		return this.constructor.$save ( this, options );
	},

	/**
	 * Delete resource.
	 * @param {Map<String,String|number|boolean>} options
	 */
	$delete : function ( options ) {
		return this.constructor.$delete ( this, options );
	}
};


// Static .......................................................................

gui.Object.each ({

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

gui.Object.each ({

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
	get : function ( id, options ) {
		var type = this;
		var then = new gui.Then ();
		var href = edb.Type.url ( this.uri, options );
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
	 * @returns {object}
	 */
	put : function ( inst, options, $method ) {
		var type = this;
		var then = new gui.Then ();
		var href = edb.Type.url ( inst.uri, options );
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
	 * @returns {object}
	 */
	post : function ( inst, options ) {
		return this.put ( inst, options, "POST" );
	},

	/**
	 * DELETE resource.
	 * @param {edb.Object|edb.Array} inst
	 * @param @optional {Map<String,object>} options
	 * @param {String} $method (Framework internal)
	 * @returns {object}
	 */
	del : function ( inst, options ) {
		return this.put ( inst, options, "DELETE" );
	},

	/**
	 * Performs the request. Perhaps you would like to overwrite this method.
	 * @param {String} url
	 * @param {String} method
	 * @param {object} payload
	 * @param {function} callback
	 */
	request : function ( url, method, payload, callback ) {
		// @TODO reference implementation using {gui.Request}
		new gui.Request ( url ).acceptJSON ().get ( function ( status, data ) {
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
	},

	/**
	 * Format URL with request options as querystring parameters.
	 * @param {String} uri
	 * param @optional {Map<String,object>} options
	 * @returns {String}
	 */
	url : function ( url, options, method ) {
		if ( gui.Type.isObject ( options )) {
			gui.Object.each ( options, function ( key, value ) {
				var fix = url.contains ( "?" ) ? "?" : "&";
				url += fix + key + "=" + String ( value );
			});
		}
		return url;
	}

}, function ( key, value ) {
	edb.Type [ key ] = value;
});