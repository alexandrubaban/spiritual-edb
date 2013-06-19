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
	 * Identification.
	 * @returns {String}
	 */
	toString : function () { return "[namespace edb]"; },

	/**
	 * Constants.
	 */
	BROADCAST_GETTER : "edb-broadcast-getter",
	BROADCAST_SETTER : "edb-broadcast-setter",
	BROADCAST_OUTPUT : "edb-broadcast-output",
	BROADCAST_FUNCTION_LOADED : "edb-broadcast-function-loaded",
	BROADCAST_TAG_LOADED : "edb-broadcast-tag-loaded",
	BROADCAST_SCRIPT_INVOKE : "edb-broadcast-script-invoke",
	LIFE_SCRIPT_WILL_RUN : "edb-life-script-will-run",
	LIFE_SCRIPT_DID_RUN : "edb-life-script-did-run",
	TICK_SCRIPT_UPDATE : "edb-tick-script-update",
	TICK_COLLECT_INPUT : "edb-tick-collect-input"
	
});



/**
 * Mixin methods and properties common 
 * to both {edb.Object} and {edb.Array}
 * @see {edb.Object}
 * @see {edb.Array}
 */
edb.Type = function () {};
edb.Type.prototype = {
	
	/**
	 * Primary storage key (serverside or localstorage).
	 * @type {String}
	 */
	$primarykey : "id",
		
	/**
	 * Instance key (clientside session only).
	 * TODO: Safari on iPad would exceed call stack when this property was prefixed with "$" 
	 * because all getters would call $sub which would then get $instancekey (ie. overflow).
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
	}
};


// Static ......................................................................

/*
 * Dispatch a getter broadcast before base function.
 */
edb.Type.getter = gui.Combo.before ( function () {
	gui.Broadcast.dispatchGlobal ( this, edb.BROADCAST_GETTER, this._instanceid );
});

/*
 * Dispatch a setter broadcast after base function.
 */
edb.Type.setter = gui.Combo.after ( function () {
	gui.Broadcast.dispatchGlobal ( this, edb.BROADCAST_SETTER, this._instanceid );
});

/**
 * Decorate getter methods on prototype.
 * @param {object} proto Prototype to decorate
 * @param {Array<String>} methods List of method names
 * @returns {object}
 */
edb.Type.decorateGetters = function ( proto, methods ) {
	methods.forEach ( function ( method ) {
		proto [ method ] = edb.Type.getter ( proto [ method ]);
	});
	return proto;
};

/**
 * Decorate setter methods on prototype.
 * @param {object} proto Prototype to decorate
 * @param {Array<String>} methods List of method names
 * @returns {object}
 */
edb.Type.decorateSetters = function ( proto, methods ) {
	methods.forEach ( function ( method ) {
		proto [ method ] = edb.Type.setter ( proto [ method ]);
	});
	return proto;
};

/**
 * Redefine the $instanceid to start with an underscore 
 * because of some iOS weirdness (does it still apply?)
 * @param {edb.Type} instance
 */
edb.Type.underscoreinstanceid = function ( instance ) {
	Object.defineProperty ( instance, "_instanceid", {
		value: instance.$instanceid
	});
};

/**
 * Is type instance?
 * @param {object} o
 * @returns {boolean}
 */
edb.Type.isInstance = function ( o ) {
	if ( gui.Type.isComplex ( o )) {
		return o instanceof edb.Object || o instanceof edb.Array;
	}
	return false;
};

/**
 * Lookup edb.Type constructor for argument (if not already an edb.Type).
 * @TODO Confirm that it is actually an edb.Type thing...
 * @param {Window|WebWorkerGlobalScope} arg
 * @param {function|string} arg
 * @returns {function} 
 */
edb.Type.lookup = function ( context, arg ) {	
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
};


/**
 * EDB object type. 
 * @extends {edb.Type}
 */
edb.Object = gui.Class.create ( "edb.Object", Object.prototype, {
	
	/**
	 * Construct edb.Object with optional data.
	 * @param @optional {object|edb.Object} data
	 */
	$onconstruct : function ( data ) {
		edb.Type.underscoreinstanceid ( this ); // iOS bug...
		switch ( gui.Type.of ( data )) {
			case "object" : 
			case "undefined" :
				edb.Object.approximate ( this, data || Object.create ( null ));
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
		var c, o = Object.create ( null );
		gui.Object.each ( this, function ( key, value ) {
			c = key [ 0 ];
			if ( c !== "$" && c !== "_" && edb.Type.isInstance ( value  )) {
				value = value.$normalize ();
			}
			o [ key ] = value;
		});
		return o;
	}


}, {}, { // Static ......................................................................

	/**
	 * Servers two purposes:
	 * 
	 * 1. Simplistic proxy mechanism to dispatch {gui.Type} broadcasts on object setters and getters. 
	 * 2. Supporting model hierarchy unfolding be newing up all that can be indentified as constructors.
	 * 
	 * @param {edb.Object} handler The edb.Object instance that intercepts properties
	 * @param {object} proxy The object whose properties are being intercepted (the JSON object)
	 */
	approximate : function ( handler, proxy ) {
		var def, Def, instances = Object.create ( null );
		this._definitions ( handler ).forEach ( function ( key ) {
			def = handler [ key ];
			if ( gui.Type.isComplex ( def )) {
				if ( gui.Type.isConstructor ( def )) {
					Def = def; // capitalized for JsHint
					instances [ key ] = new Def ( proxy [ key ]);
				}
			} else if ( !gui.Type.isDefined ( proxy [ key ])) {
				proxy [ key ] = handler [ key ];
			}
		});
		
		/* 
		 * Setup property accessors for handler. 
		 * @TODO how does types get serialized back to server?
		 *
		 * 1. Objects by default convert to edb.Object
		 * 2. Arrays by default convert to edb.Array
		 * 3. Simple properties get proxy accessors
		 */
		gui.Object.nonmethods ( proxy ).forEach ( function ( key ) {
			switch ( gui.Type.of ( def = proxy [ key ])) {
				case "object" :
					handler [ key ] = new edb.Object ( def );
					break;
				case "array" :
					handler [ key ] = new edb.Array ( def );
					break;
				default :
					gui.Property.accessor ( handler, key, {
						getter : edb.Type.getter ( function () {
							return instances [ key ] || proxy [ key ];
						}),
						setter : edb.Type.setter ( function ( value ) {
							var target = instances [ key ] ? instances : proxy;
							target [ key ] = value;
						})
					});
					break;
			}
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
		gui.Object.all ( handler, function ( key, value ) {
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
( function mixin () {
	gui.Object.extend ( 
		edb.Object.prototype, 
		edb.Type.prototype 
	);
}());


/**
 * EDB array-like type.
 * @extends {edb.Type} (although not really)
 */
edb.Array = gui.Class.create ( "edb.Array", Array.prototype, {
	
	/**
	 * The content type can be declared as:
	 *
	 * 1. An edb.Type constructor function (my.ns.MyType)
	 * 2. A filter function to accept JSON (for analysis) and return a constructor.
	 * @type {function} Type constructor or filter function
	 */
	$of : null,

	/**
	 * Secret constructor.
	 */
	$onconstruct : function () {
		edb.Type.underscoreinstanceid ( this ); // iOS bug...
		if ( arguments.length ) {
			// accept one argument (an array) or use Arguments object as an array
			var args = [];
			if ( gui.Type.isArray ( arguments [ 0 ])) {
				args = arguments [ 0 ];
			} else {
				Array.forEach ( arguments, function ( arg ) {
					args.push ( arg );
				});
			}
			var type = this.$of;
			if ( gui.Type.isFunction ( type )) {
				args = args.map ( function ( o, i ) {
					if ( o !== undefined ) { // why can o be undefined in Firefox?
						if ( !o._instanceid ) { // TODO: underscore depends on iPad glitch, does it still glitch?
							var Type = type;//  type constructor or... 
							if ( !gui.Type.isConstructor ( Type )) { // ... filter function?
								Type = type ( o );
							}
							o = new Type ( o );
						}
					}
					return o;
				});
			}
			args.forEach ( function ( arg ) {
				Array.prototype.push.call ( this, arg ); // bypassing broadcast mechanism
			}, this );
		}

		// proxy methods and invoke non-secret constructor
		edb.Array.approximate ( this );
		this.onconstruct.call ( this, arguments );
	},

	/**
	 * Create true array without expando properties, recursively 
	 * normalizing nested EDB types. This is the type of object 
	 * you would typically transmit to the server. 
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
	
	
}, {}, { // Static .........................................................................

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
	}

});

/*
 * Overloading array methods.
 * @using {edb.Array.prototype}
 */
( function using ( proto ) {

	"use strict";

	/*
	 * Mixin methods and properties common 
	 * to both {edb.Object} and {edb.Array}
	 */
	gui.Object.extend ( proto, edb.Type.prototype );

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
	 */
	edb.Type.decorateSetters ( proto, [
		"push",
		"pop", 
		"shift", 
		"unshift", 
		"splice", 
		"reverse" 
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
	
}( edb.Array.prototype ));


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
	 * @param {Window|WebWorkerGlobalScope} context
	 * @param {object|array|edb.Type} data
	 * @param @optional {function|string} Type
	 */
	dispatch : function ( context, data, Type ) {
		var input = edb.Input.format ( context, data, Type );
		if ( input instanceof edb.Input ) {
			if ( input.type ) {
				input.type.output = input; // TODO: RENAME this abomination
				gui.Broadcast.dispatch ( null, edb.BROADCAST_OUTPUT, input, context.gui.$contextid );
			} else {
				throw new Error ( "edb.Input type is " + input.type );
			}
		} else {
			throw new TypeError ( "Not an instance of edb.Input: " + input );
		}
	}
};


/**
 * Note: This plugin may be used standalone, so don't reference any spirits around here.
 * @TODO formalize how this is supposed to be clear
 * @TODO static interface for all this stuffel
 */
edb.OutputPlugin = gui.Plugin.extend ( "edb.OutputPlugin", {

	/**
	 * Output data as type.
	 * @param {object} data JSON object or array (demands arg 2) or an edb.Type instance (omit arg 2).
	 * @param @optional {function|String} type edb.Type constructor or "my.ns.MyType"
	 */
	dispatch : function ( data, Type ) {
		edb.Output.dispatch ( this.context, data, Type );
		/*
		var input = this._format ( data, Type );
		if ( input instanceof edb.Input ) {
			if ( input.type ) {
				input.type.output = input; // TODO: RENAME this abomination
				gui.Broadcast.dispatchGlobal ( 
					this.sandboxed ? null : this.spirit, 
					edb.BROADCAST_OUTPUT, 
					input 
				);
			} else {
				throw new Error ( "edb.Input type is " + input.type );
			}
		} else {
			throw new TypeError ( "Not an instance of edb.Input: " + input );
		}
		*/
	},
	
	
	// PRIVATES .........................................................................
	
	/**
	 * Wrap data in edb.Input before we output.
	 * TODO: DON'T AUTOMATE TYPES, let's just output JSON objects. OR WHAT???
	 * @param {object} data
	 * @param @optional {function|String} Type
	 * @returns {edb.Input}
	 */
	_format : function ( data, Type ) {
		if ( data instanceof edb.Input === false ) {
			if ( Type ) {
				Type = this._lookup ( Type );
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
				data = this._format ( data, Type );
			} else {
				Type = data.constructor;
			}
			data = new edb.Input ( Type, data ); // data.constructor?
		}
		return data;
	},

	/**
	 * Lookup edb.Type constructor for argument (if not it is already).
	 * @TODO Check that it is actually an edb.Type thing...
	 * @param {object} arg
	 * @returns {function}
	 */
	_lookup : function ( arg ) {	
		var type = null;
		switch ( gui.Type.of ( arg )) {
			case "function" :
				type = arg;
				break;
			case "string" :
				type = gui.Object.lookup ( arg, this.context );
				break;
			case "object" :
				console.error ( this + ": expected edb.Type constructor (not an object)" );
				break;
		}
		if ( !type ) {
			throw new TypeError ( "The type \"" + arg + "\" does not exist" );
		}
		return type;
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
 * Tracking EDB input. Note that the {edb.Script} is uisng this plugin (though it's not a spirit).
 * @extends {gui.Tracker}
 */
edb.InputPlugin = gui.Tracker.extend ( "edb.InputPlugin", {
   
	/**
	 * True when one of each expected input type has been collected.
	 * @type {boolean}
	 */
	done : true,
	
	/**
	 * Construction time.
	 * @overloads {gui.Tracker#construct}
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		this._watches = [];
		this._matches = [];
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
		gui.Broadcast.add ( edb.BROADCAST_OUTPUT, this, this.context.gui.$contextid );
	}),

	/**
	 * Remove handler for one or more input types.
	 * @TODO Cleanup more stuff?
	 * @param {object} arg
	 * @param @optional {object} handler implements InputListener (defaults to this)
	 * @returns {gui.InputPlugin}
	 */
	remove : gui.Combo.chained ( function ( arg, handler ) {
		handler = handler ? handler : this.spirit;
		arg = edb.InputPlugin._breakdown ( arg, this.context );
		this._remove ( arg, handler );
		if (( this.done = this._matches.length === this._watches.length )) { // right?
			gui.Broadcast.remove ( edb.BROADCAST_OUTPUT, this, this.context.gui.$contextid );	
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
		types.forEach ( function ( type ) {
			this._watches.push ( type );
			this._addchecks ( type.$classid, [ handler ]);
			if ( type.output ) { // type has been output already?
				gui.Tick.next(function(){ // allow nested {edb.ScriptSpirit} to spiritualize first
					this._todoname ();
				}, this );
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

	/*
	 * TODO: Comment goes here.
	 */
	_todoname : function () {
		this._watches.forEach ( function ( type ) {
			if ( type.output instanceof edb.Input ) {
				this._maybeinput ( type.output );
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
	}


}, {}, { // Static .............................................................

	/**
	 * Breakdown argument into array of one or more types.
	 * @param {object} arg
	 * @param {Window} context
	 * @returns {Array<function>}
	 */
	_breakdown : function ( arg, context ) {
		switch ( gui.Type.of ( arg )) {
			case "array" :
				return this._breakarray ( arg, context );
			default :
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
edb.ScriptPlugin = gui.Plugin.extend ( "edb.ScriptPlugin", {
	
	/**
	 * The {gui.BaseScript} is rigged up to support alternative 
	 * template languages, but we default to EDBML around here.
	 * @type {String}
	 */
	type : "text/edbml",

	/**
	 * The Script SRC must be set before 'spirit.onenter()' 
	 * to automatically load when spirit enters the DOM.
	 * @type {String}
	 */
	src : null,

	/**
	 * True when there's a script; and when it's loaded.
	 * @TODO Should there also be a "loading" boolean?
	 * @TODO Should all this happen via life events?
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
		if ( spirit instanceof edb.ScriptSpirit ) {
			this.autorun = false;
		} else if ( this.diff ) {
			this._updater = new edb.UpdateManager ( spirit );
		}
		if ( this.src ) {
			spirit.life.add ( gui.LIFE_ENTER, this );
		}
	},

	/**
	 * Waiting for onenter() to load the script (forgot why). This takes a
	 * repaint hit if and when the script gets loaded externally. @TODO: 
	 * all kinds of global preloading flags to render everything at once.
	 * @param {gui.Life} life
	 */
	onlife : function ( life ) {
		if ( life.type === gui.LIFE_ENTER ) {
			this.load ( this.src );
		}
	},

	/**
	 * Return data for input of type.
	 * @param {function} type
	 * @returns {object}
	 */
	inputs : function ( type ) {
		return this._script.input.get ( type );
	},

	/**
	 * Load script from SRC. This happens async unless the SRC 
	 * points to a script embedded in the spirits own document 
	 * (and unless script has already been loaded into context).
	 * @param {String} src 
	 * @param @optional {String} type Script mimetype (eg "text/edbml")
	 */
	load : function ( src, type ) {
		edb.Template.load ( this.context, src, type || this.type, 
			function onreadystatechange ( script ) {
				this._onreadystatechange ( script );
				//this._onready ( script );
			},
		this );
	},

	/**
	 * Compile script from source TEXT and run it when ready.
	 * @param {String} source Script source code
	 * @param @optional {String} type Script mimetype (eg "text/edbml")
	 * @param @optional {HashMap<String,String>} directives Optional compiler directives
	 */
	compile : function ( source, type, directives ) {
		edb.Template.compile ( this.context, source,  type || this.type, directives, 
			function onreadystatechange ( script ) {
				this._onreadystatechange ( script );
				//this._onready ( script );
			}, 
		this );
	},

	/**
	 * Run script (with implicit arguments) and write result to DOM.
	 * @see {gui.SandBoxView#render}
	 */
	run : function () {
		if ( this.loaded ) {
			this._script.pointer = this.spirit; // TODO!
			this.write ( 
				this._script.run.apply ( 
					this._script, 
					arguments 
				)
			);
		} else {
			console.error ( "Running uncompiled script" );
		}
	},

	/**
	 * Private input.
	 * @param {object} data JSON object or array (demands arg 2) or an edb.Type instance (omit arg 2).
	 * @param @optional {function|String} type edb.Type constructor or "my.ns.MyType"
	 */
	input : function ( data, Type ) {
		var input = edb.Input.format ( this.context, data, Type );
		if ( this._script ) {
			this._script.input.match ( input );
		} else {
			this._doinput = this._doinput || [];
			this._doinput.push ( input );
		}
	},
	
	/**
	 * Write the actual HTML to screen. You should probably only 
	 * call this method if you are producing your own markup 
	 * somehow, ie. not using EDBML templates out of the box. 
	 * @TODO Only do something if string argument has diffed 
	 * @param {String} html
	 */
	write : function ( html ) {
		if ( this.diff ) {
			this._updater.update ( html );
		} else {
			this.spirit.dom.html ( html ); // TODO: forms markup make valid!
		}
		this.ran = true;
		this.spirit.life.dispatch ( 
			edb.LIFE_SCRIPT_DID_RUN,  
			( this._latest = html ) !== this._latest // @TODO Support this kind of arg...
		);

		/**
		 * Fit any containing iframe in next tick.
		 * @TODO: make sure IframeSpirit consumes this if not set to fit
		 */
		if ( this.context.gui.hosted ) {
			var temptick = "temptick"; // @TODO
			var sig = this.context.gui.$contextid;
			gui.Tick.one ( temptick, this, sig ).dispatch ( temptick, 0, sig );
		}
	},

	/**
	 * If in an iframe, now is the time to fit the iframe 
	 * to potential new content (emulating seamless iframes).
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {
		if ( tick.type === "temptick" ) {
			this.spirit.action.dispatchGlobal ( gui.ACTION_DOC_FIT );
		}
	},
	

	// PRIVATES ...........................................................................

	/**
	 * Hello.
	 * @type {edb.Script}
	 */
	_script : null,

	/**
	 * Update manager. 
	 * @type {edb.UpdateManager}
	 */
	_updater : null,

	/*
	 * Private input for script once loaded.
	 * @type {edb.Input}
	 */
	_doinput : null,

	/**
	 * Handle script state.
	 * @param {edb.Script} script
	 */
	_onreadystatechange : function ( script ) {
		this._script = this._script || script;
		switch ( script.readyState ) {
			case edb.Template.WAITING :
				if ( this._doinput ) {
					while ( this._doinput.length ) {
						this.input ( this._doinput.shift ());
					}
					this._doinput = null;
				}
				break;
			case edb.Template.READY :
				if ( !this.loaded ) {
					this.loaded = true;
					if ( this.debug ) {
						script.debug ();
					}
				}
				if ( this.autorun ) {
					this.run ();
				}
				break;
		}
	}


}, { // STATICS .........................................................................

	/**
	 * Constructed immediately.
	 * @overwrites (gui.Plugin#lazy)
	 * @type {boolean}
	 */
	lazy : false

});



/**
 * TODO: Description goes here.
 */
edb.ScriptSpirit = gui.Spirit.infuse ( "edb.ScriptSpirit", {
	
	/**
	 * Debug compiled function to console? You can set this in HTML:
	 * &lt;script type="text/edbml" debug="true"/&gt;
	 * @type {boolean}
	 */
	debug : false,
	
	onconfigure : function () {
		this._super.onconfigure ();
		this.att.add ( "debug" );
	},

	/**
	 * Map "debug" attribute to this.debug
	 * @param {gui.Att} att
	 */
	onatt : function ( att ) {
		this._super.onatt ( att );
		if ( att.name === "debug" ) {
			this.debug = att.value;
		}
	},
	
	/**
	 * Relay source code to the {edb.ScriptPlugin} of either this or parent spirit.
	 */
	onenter : function () {
		this._super.onenter ();
		if ( !this._plainscript ()) {
			if ( this.dom.parent ( gui.Spirit )) {
				this._initplugin ();
			}
		}
	},
	
	
	// PRIVATES ............................................................................
	
	/**
	 * Is plain JS?
	 * TODO: regexp this not to break on vendor subsets (e4x etc)
	 * TODO: forget about it, just require contains "edbml" ignorecase
	 * @returns {boolean}
	 */
	_plainscript : function () {
		var is = false;
		switch ( this.att.get ( "type" )) {
			case null :
			case "text/ecmacript" :
			case "text/javascript" :
			case "application/javascript" :
			case "application/x-javascript" :
				is = true;
				break;
		}
		return is;
	},

	/**
	 * Init an {edb.ScriptPlugin} from source code. If this script is placed directly
	 * inside a parent spirit, we target the parent spirits {edb.ScriptPlugin} (explain more)
	 */
	_initplugin : function () {
		var src = this.att.get ( "src" ) || this.src,
			type = this.att.get ( "type" ) || this.type,
			parent = this.dom.parent (),
			extras = this.att.getmap (),
			plugin = parent.spirit.script;
		plugin.extras = extras;
		plugin.debug = this.debug;
		if ( src ) {
			plugin.load ( src, type, extras );
		} else {
			plugin.compile ( this.dom.text (), type, extras );
		}
	}

});



/**
 * Spirit of the data service.
 * @see http://wiki.whatwg.org/wiki/ServiceRelExtension
 */
edb.ServiceSpirit = gui.Spirit.infuse ( "edb.ServiceSpirit", {
	
	/**
	 * Default to accept JSON and fetch data immediately.
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		var type = this.att.get ( "type" );
		if ( type ) {
			var Type = gui.Object.lookup ( type, this.window );
			if ( this.att.get ( "href" )) {
				new gui.Request ( this.element.href ).acceptJSON ().get ( function ( status, data ) {
					this.output.dispatch ( new Type ( data ));
				}, this );
			} else {
				this.output.dispatch ( new Type ());
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
 * This fellow compiles a template source string. 
 * The onreadystatechange method fires when ready, 
 * the method "run" may by then invoke the script.
 */
edb.Template = gui.Class.create ( "edb.Template", Object.prototype, {
	
	/**
	 * Script may be run when this switches to "ready".
	 * @type {String}
	 */
	readyState : null,
	
	/**
	 * Method is for script users to implement.
	 * @type {function}
	 */
	onreadystatechange : null,
	
	/**
	 * The window context (or any kind of global context).
	 * @type {Window}
	 */
	context : null,
	
	/**
	 * Spirit (or potentital other entity) running the script.
	 * @type {object}
	 */
	spirit : null,
	
	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Template]";
	},
	
	/**
	 * Construct.
	 * TODO: destruct?
	 * @param {gui.Spirit} spirit
	 * @param {Window} window
	 * @param {function} handler
	 */
	onconstruct : function ( spirit, window, handler ) {
		this.spirit = spirit || null;
		this.context = window || null;
		this.onreadystatechange = handler || null;
	},
	
	/**
	 * Compile source to invokable function (open for implementation).
	 * @param {String} source
	 * @param {Map<String,object>} directives
	 * @returns {edb.Template}
	 */
	compile : function ( source, directives ) {},
	
	/**
	 * Run the script to produce some HTML (open for implementation).
	 * @returns {String} 
	 */
	run : function () {},
	
	
	// PRIVATES ....................................................................
	
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
	}
	
	
}, {}, { // STATICS ................................................................
	
	/**
	 * Used only in development mode (or how was it?).
	 * @type {String}
	 */
	LOADING : "loading",

	/**
	 * @static
	 * Script is waiting for input.
	 * @type {String}
	 */
	WAITING : "waiting",

	/**
	 * @static
	 * Script is processing something.
	 * @type {String}
	 */
	WORKING : "working",

	/**
	 * @static
	 * Script is ready to run.
	 * @type {String}
	 */
	READY : "ready",
		
	/**
	 * Register implementation for one or more mimetypes. 
	 * @param {function} implementation
	 * @param {String} mimeype (accepts multiple mimetype args)
	 */
	setImplementation : function () { // implementation, ...mimetypes
		var args = gui.Object.toArray ( arguments );
		var impl = args.shift ();
		args.forEach ( function ( type ) {
			this._implementations.set ( type, impl );
		}, this );
	},
	
	/**
	 * Get implementation for mimetype.
	 * TODO: rename
	 * @returns {edb.Template}
	 */
	getImplementation : function ( type ) {
		var impl = this._implementations.get ( type );
		if ( !impl ) {
			throw new Error ( "No implementation for: " + type );
		}
		return impl;
	},

	/**
	 * Load and compile script from SRC.
	 * @param {Window} context
	 * @param {String} src
	 * @param {String} type
	 * @param {function} callback
	 * @param {object} thisp
	 */
	load : function ( context, src, type, callback, thisp ) {
		new edb.TemplateLoader ( context.document ).load ( src, function ( source ) {
			var url = new gui.URL ( context.document, src );
			var script = edb.Script.get ( url.href ); // todo - localize!
			if ( !script ) {
				this.compile ( context, source, type, null, function ( script ) {
					edb.Script.set ( url.href, script );
					callback.call ( thisp, script );
				}, this );
			} else {
				callback.call ( thisp, script );
			}
		}, this );
	},

	/**
	 * Compile script from source text.
	 * @param {Window} context
	 * @param {String} src
	 * @param {String} type
	 * @param {Mao<String,object>} directives
	 * @param {function} callback
	 * @param {object} thisp
	 */
	compile : function ( context, source, type, directives, callback, thisp ) {
		var Script = this.getImplementation ( type );
		var script = new Script ( null, context, function onreadystatechange () {
			callback.call ( thisp, this );
		});
		script.compile ( source, directives );
	},


	// Private static .........................................................

	/**
	 * Mapping implementations to mimetypes.
	 * @type {Map<String,edb.Template>}
	 */
	_implementations : new Map ()

});


/**
 * The template loader will fetch a template string from an external 
 * document or scan the local document for templates in SCRIPT tags.
 * @extends {gui.FileLoader}
 */
edb.TemplateLoader = gui.FileLoader.extend ({

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
	 * Handle loaded script source; externally loaded file may contain multiple scripts.
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
		callback.call ( thisp, text, this.directives );
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
		this.directives = gui.AttPlugin.getmap ( script );
		this.onload ( script.textContent, url, callback, thisp );
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


}, {}, { // STATICS ....................................................
	
	/**
	 * @static
	 * Mapping scriptloaders to mimetypes.
	 * @type {Map<String,edb.BaseLoader>}
	 */
	_loaders : new Map (),

	/**
	 * @static
	 * Register scriptloader for one or more mimetypes. 
	 * TODO: rename!
	 */
	set : function () { // implementation, ...mimetypes
		var args = gui.Object.toArray ( arguments );
		var impl = args.shift ();
		args.forEach ( function ( type ) {
			this._loaders.set ( type, impl );
		}, this );
	},
		
	/**
	 * @static
	 * Get loader for mimetype (what corresponds 
	 * to the "type" attribute of a script tag),
	 * TODO: rename!
	 * @param {String} type
	 * @returns {edb.BaseLoader}
	 */
	get : function ( type ) {
		var impl = edb.BaseLoader;
		if ( type ) {
			impl = this._loaders.get ( type );
			if ( !impl ) {
				throw new Error ( "No script loader registered for type: " + type );
			}
		}
		return impl;
	}
});


/**
 * Core EDBML compiler business logic.
 */
edb.Compiler = gui.Class.create ( "edb.Compiler", Object.prototype, {

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
				if ( status.peek || status.poke ) {}
				break;
			case "}" :
				if ( status.peek ) {
					status.peek = false;
					status.skip = 1;
					result.body += ") + '";
				}
				if ( status.poke ) {
					this._poke ( status, result );
					status.poke = false;
					result.temp = null;
					status.spot = -1;
					status.skip = 1;
				}
				break;
			case "$" :
				if ( !status.peek && !status.poke && runner.ahead ( "{" )) {
					status.peek = true;
					status.skip = 2;
					result.body += "' + (";
				}
				break;
			case "#" :
				if ( !status.peek && !status.poke && runner.ahead ( "{" )) {
					status.poke = true;
					status.skip = 2;
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
			"var " + name + " = edb.Script.assign ( function ( value, checked ) { \n" +
			temp + ";\n}, this );" + next +
			"edb.Script.register ( event ).invoke ( &quot;\' + " + name + " + \'&quot;" + sig + " );";
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
	 * @TODO https://github.com/jshint/jshint/issues/383
	 * @type {RegExp}
	 */
	_ATTREXP : /^[^\d][a-zA-Z0-9-_\.]+/

});


/**
 * Compile EDB function.
 * @TODO precompiler to strip out both JS comments and HTML comments.
 */
edb.FunctionCompiler = edb.Compiler.extend ( "edb.FunctionCompiler", {

	/**
	 * Source of compiled function.
	 * @type {String}
	 */
	source : null,
	
	/**
	 * Compiled function arguments list. 
	 * @type {Array<String>}
	 */
	params : null,

	/**
	 * Imported functions and tags.
	 * @type {Array<edb.Dependency>}
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
	 * Compile EDBML to invocable function.
	 * @param {Window} context
	 * @param @optional {boolean} fallback
	 * @returns {function}
	 */
	compile : function ( context ) {
		var result = null;
		this.dependencies = [];
		this.params = [];
		this._context = context;
		this._vars = [];
		var head = {
			declarations : Object.create ( null ), // Map<String,boolean>
			functiondefs : [] // Array<String>
		};
		this.sequence.forEach ( function ( step ) {
			this.source = this [ step ] ( this.source, head );
		}, this );
		try {
			result = this._convert ( this.source, this.params );
			this.source = this._source ( this.source, this.params );
		} catch ( exception ) {
			result = this._fail ( exception );
		}
		return result;
	},

	/**
	 * Sign generated methods with a gui.$contextid key. This allows us to evaluate assigned 
	 * functions in a context different to where the template HTML is used (sandbox scenario).
	 * @param {String} $contextid
	 * @returns {edb.ScriptCompiler}
	 */
	sign : function ( $contextid ) {
		this._$contextid = $contextid;
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
				this.params.push ( name );
				break;
			case "function" :
			case "tag" :
				if ( type === edb.Dependency.TYPE_TAG ) {
					if ( href.contains ( "#" )) {
						name = href.split ( "#" )[ 1 ];
					} else {
						throw new Error ( "Missing tag #identifier: " + href );
					}
				}
				this.dependencies.push ( 
					new edb.Dependency ( 
						cont,
						type,
						name,
						href
					)
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
			funcs.push ( dep.name + " = functions ( self, '" + dep.href + "' );\n" );
		}, this );
		if ( funcs [ 0 ]) {
			head.functiondefs.push ( 
				"( function lookup ( functions ) {\n" +
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
		var vars = "";
		Object.keys ( head.declarations ).forEach ( function ( name ) {
			vars += ", " + name;
		});
		var html = "var Out = edb.Out, Att = edb.Att, Tag = edb.Tag, out = new Out (), att = new Att ()" + vars +";\n";
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
	}
	

}, {}, { // Static ............................................................................

	/**
	 * @static
	 * Test for nested scripts (because those are not parsable in the browser). 
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
	compile : function ( scope, fallback ) {
		this.inputs = Object.create ( null );
		return this._super.compile ( scope, fallback );
	},

	/**
	 * Declare.
	 * @overloads {edb.FunctionCompiler} declare
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
			defs.push ( name + " = inputs ( " + type + " );\n" );
		}, this );
		if ( defs [ 0 ]) {
			head.functiondefs.push ( 
				"( function lookup ( inputs ) {\n" +
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
edb.TagCompiler = edb.FunctionCompiler.extend ( "edb.TagCompiler", {

	/**
	 * We added the "tag" directive ourselves.
	 * @overloads {edb.FunctionCompiler._direct}
	 * @param  {String} script
	 * @returns {String}
	 */
	_direct : function ( script ) {
		if ( this.directives.tag ) {
			var content = edb.TagCompiler._CONTENT;
			this.params.push ( "content" );
			this.params.push ( "attribs" );
			this.params.push ( "COMPILED_AS_TAG" );
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
 * Tracking a single function dependency.
 * @param {Window} context @TODO: use $contextid instead...
 * @param {String} type
 * @param {String} name
 * @param {String} href
 */
edb.Dependency = function ( context, type, name, href ) {
	this.href = gui.URL.absolute ( context.document, href );
	this.type = type;
	this.name = name;
	this._context = context;
};

edb.Dependency.prototype = {

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
	 * Dependency URL location.
	 * @type {String}
	 */
	href : null,

	/**
	 * @param {Window} context
	 */
	resolve : function () {
		var res = this._source ().get ( this._context, this.href );
		var then = this._then = new gui.Then ();
		if ( res ) {
			then.now ( res );
		} else {
			gui.Broadcast.add ( 
				edb.BROADCAST_FUNCTION_LOADED, 
				this, this._context.gui.$contextid 
			);
		}
		return then;
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} b
	 */
	onbroadcast : function ( b ) {
		switch ( b.type ) {
			case edb.BROADCAST_FUNCTION_LOADED :
				if ( b.data === this.href ) {
					this._then.now ( this._source ().get ( this._context, this.href ));
					gui.Broadcast.remove ( b.type, this, b.$contextid );
					this._context = null;
					this._then = null;
				}
				break;
		}
	},

	/**
	 * Compute relevant place to lookup compiled functions.
	 * @returns {function}
	 */
	_source : function () {
		switch ( this.type ) {
			case edb.Dependency.TYPE_FUNCTION :
				return edb.Function;
			case edb.Dependency.TYPE_TAG :
				return edb.Tag;
		}
	},


	// Private .......................................

	/**
	 * @TODO: use $contextid instead...
	 * @type {Window}
	 */
	_context : null,

	/**
	 * @type {gui.Then}
	 */
	_then : null
};

/**
 * Function dependency.
 * @type {String}
 */
edb.Dependency.TYPE_FUNCTION = "function";

/**
 * Tag dependency.
 * @type {String}
 */
edb.Dependency.TYPE_TAG = "tag";


/**
 * EDB function.
 * @extends {edb.Template}
 */
edb.Function = edb.Template.extend ( "edb.Function", {

	/**
	 * The window context; where to lookup data types.
	 * @type {Global}
	 */
	context : null,
	
	/**
	 * Target for the "this" keyword in compiled function. For sandboxes, this  
	 * refers to the worker global context; otherwise it's a spirit instance.
	 * @type {object}
	 */
	pointer : null,
	
	/**
	 * Expected script params. Must know how many.
	 * @type {Array<String>}
	 */
	params : null,

	/**
	 * Mapping dependencies while booting, converted to functions once resolved.
	 * @type {Map<String,edb.Dependency|function>}
	 */
	functions : null,
	
	/**
	 * Construct.
	 * @param {object} pointer
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( pointer, context, handler ) {
		this._super.onconstruct ( pointer, context, handler );
		this.functions = Object.create ( null );
		/*
		 * Redefine these terms into concepts that makes more 
		 * sense when runinng script inside a worker context. 
		 * (related to a future "sandbox" project of some kind)
		 */
		this.pointer = this.spirit;
		this.context = context;
		this.spirit = null;
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
	compile : function ( source, directives ) {
		if ( this._function === null ) {
			var compiler = this._compiler = new ( this._Compiler ) ( source, directives );
			if ( this._$contextid ) {
				compiler.sign ( this._$contextid );
			}
			this._function = compiler.compile ( this.context );
			this._source = compiler.source;
			this.params = compiler.params;
			this._dependencies ( compiler );
		} else {
			throw new Error ( "TODO: recompile the script :)" );
		}
		return this._oncompiled ();
	},

	/**
	 * Log script source to console.
	 */
	debug : function () {
		if(this._debugt){
			console.error ( "WHY TWICE?" );
		}
		this._debugt = true;
		console.debug ( this._source );
	},

	/**
	 * Resolve dependencies.
	 * @param {edb.Compiler} compiler
	 */
	_dependencies : function ( compiler ) {
		compiler.dependencies.filter ( function ( dep ) {
			return true; // return dep.type === edb.Dependency.TYPE_FUNCTION;
		}).map ( function ( dep ) {
			this.functions [ dep.name ] = null; // null all first
			return dep;
		}, this ).forEach ( function ( dep ) {
			dep.resolve ().then ( function ( resolved ) {
				this.functions [ dep.name ] = resolved;
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
	 * Run the script. Returns a string.
	 * @returns {String} 
	 */
	run : function () { // arguments via apply()
		var result = null;
		if ( this._function ) {
			try {
				this._subscribe ( true );
				result = this._function.apply ( this.pointer, arguments );
				this._subscribe ( false );
			} catch ( exception ) {
				console.error ( exception.message + ":\n\n" + this._source );
			}
		} else {
			throw new Error ( "Script not compiled" );
		}
		return result;
	},
	
	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} broadcast
	 */
	onbroadcast : function ( b ) {
		switch ( b.type ) {
			case edb.BROADCAST_FUNCTION_LOADED :
				this._functionloaded ( b.data );
				break;
		}
	},
	
	
	// PRIVATES ..........................................................................................
	
	/**
	 * TODO: MAKE NOT PRIVATE (used by edb.Function).
	 * Script source compiled to invocable function.
	 * @type {function}
	 */
	_function : null,
	
	/**
	 * Optionally stamp a $contextid into generated edb.Script.invoke() callbacks.
	 * @type {String} 
	 */
	_$contextid : null,

	/**
	 * Compiler implementation (subclass may overwrite it).
	 * @type {function}
	 */
	_Compiler : edb.FunctionCompiler,

	/**
	 * Compiler instance.
	 * @type {edb.FunctionCompiler}
	 */
	_compiler : null,

	/**
	 * In development mode, load invokable function as a blob file; otherwise skip to init.
	 */
	_oncompiled : function () {
		try {
			if ( this._useblob ()) {
				this._loadblob ();
			} else {
				this._maybeready ();
			}
		} catch ( workerexception ) { // sandbox scenario
			this._maybeready ();
		}
		return this;
	},

	/**
	 * Use blob files?
	 * @returns {boolean} Always false if not development mode
	 */
	_useblob : function () {
		return edb.Function.useblob && 
			this.context.gui.debug && 
			gui.Client.hasBlob && 
			!gui.Client.isExplorer && 
			!gui.Client.isOpera;
	},
	
	/**
	 * In development mode, load compiled script source as a file. 
	 * This allows browser developer tools to assist in debugging. 
	 * Note that this introduces an async step of some kind...
	 * @param {edb.FunctionCompiler} compiler
	 */
	_loadblob : function () {
		var win = this.context;
		var doc = win.document;
		var key = gui.KeyMaster.generateKey ( "function" );
		var src = this._compiler.source.replace ( "function", "function " + key );
		this._gostate ( edb.Template.LOADING );
		gui.BlobLoader.loadScript ( doc, src, function onload () {
			this._gostate ( edb.Template.WORKING );
			this._function = win [ key ];
			this._maybeready ();
		}, this );
	},

	/**
	 * Report ready? Otherwise waiting 
	 * for data types to initialize...
	 */
	_maybeready : function () {
		if ( this.readyState !== edb.Template.LOADING ) {
			this._gostate ( edb.Template.WORKING );
			if ( this._done ()) {
				this._gostate ( edb.Template.READY );
			} else {
				this._gostate ( edb.Template.WAITING );
			}
		}
	},

	/**
	 * Ready to run?
	 * @returns {boolean}
	 */
	_done : function () {
		return Object.keys ( this.functions ).every ( function ( name ) {
			return this.functions [ name ] !== null;
		}, this );
	},
	
	/**
	 * Add-remove broadcast handlers.
	 * @param {boolean} isBuilding
	 */
	_subscribe : function ( isBuilding ) {
		gui.Broadcast [ isBuilding ? "addGlobal" : "removeGlobal" ] ( edb.BROADCAST_GETTER, this );
		gui.Broadcast [ isBuilding ? "removeGlobal" : "addGlobal" ] ( edb.BROADCAST_SETTER, this );
	}


}, { // Recurring static ................................................

	/**
	 * Get function for SRC.
	 * @param {Window} win
	 * @param {String} src
	 * @returns {function}
	 */
	get : function ( win, src ) {
		if ( gui.Type.isWindow ( win )) {
			console.debug ( "TODO: use $contextid" );
		}
		src = new gui.URL ( win.document, src ).href;
		if ( !gui.Type.isFunction ( this._map [ src ])) {
			return this._load ( src, win );
		}
		return this._map [ src ] || null;
	},


	// Private recurring static ...........................................

	/**
	 * Message to dispatch when function is loaded. 
	 * The function src appears as broadcast data.
	 * @type {String}
	 */
	_broadcast : edb.BROADCAST_FUNCTION_LOADED,

	/**
	 * Mapping src to (loaded and compiled) function.
	 * @type {Map<String,function>}
	 */
	_map : Object.create ( null ),

	/**
	 * Load function from SRC (async) or lookup in local document (sync).
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function} only if sync (otherwise we wait for broadcast)
	 */
	_load : function ( src, win ) {
		var func = null, 
			Implementation = this, 
			cast = this._broadcast, 
			sig = win.gui.$contextid;
		new edb.TemplateLoader ( win.document ).load ( src,
			function onload ( source, directives ) {
				if ( source ) {
					new Implementation ( null, win, function onreadystatechange () {
						if ( this.readyState === edb.Template.READY ) {
							func = Implementation._map [ src ] = this._function;
							if ( directives.debug ) {
								this.debug ();
							}
							gui.Broadcast.dispatch ( null, cast, src, sig );
						}
					}).compile ( source, directives );
				}
			}
		);
		return func;
	}


}, { // Static ...................................................

	/**
	 * Mount compiled scripts as blob files in development mode?
	 * @TODO map to gui.Client.hasBlob somehow...
	 * @type {boolean}
	 */
	useblob : true

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
edb.Script = edb.Function.extend ( "edb.Script", {

	/**
	 * Hijacking the {edb.InputPlugin} which has been 
	 * designed to work without an associated spirit.
	 * @type {edb.InputPlugin}
	 */
	input : null,

	/**
	 * Construct.
	 * @poverloads {edb.Function#onconstruct}
	 * @param {object} pointer
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( pointer, context, handler ) {
		this._super.onconstruct ( pointer, context, handler );
		this.input = new edb.InputPlugin ();
		this.input.context = this.context; // as constructor arg?
		this.input.onconstruct (); // huh?
		console.warn ( "Bad: onconstruct should autoinvoke" );
		this._keys = new Set (); // tracking data changes

		// @TODO this *must* be added before it can be removed ?
		gui.Broadcast.addGlobal ( edb.BROADCAST_SETTER, this );
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} broadcast
	 */
	onbroadcast : function ( b ) {
		this._super.onbroadcast ( b );
		switch ( b.type ) {
			case edb.BROADCAST_GETTER :
				this._keys.add ( b.data );
				break;
			case edb.BROADCAST_SETTER :
				if ( this._keys.has ( b.data )) {
					if ( this.readyState !== edb.Template.WAITING ) {
						var tick = edb.TICK_SCRIPT_UPDATE;
						var sig = this.context.gui.$contextid;
						gui.Tick.one ( tick, this, sig ).dispatch ( tick, 0, sig );	
						this._gostate ( edb.Template.WAITING );
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
				this._gostate ( edb.Template.READY );
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
	 * Run the script. Returns a string.
	 * @overloads {edb.Function#run}
	 * @returns {String}
	 */
	run : function () {
		this._keys = new Set ();
		if ( this.input.done ) {
			return this._super.run.apply ( this, arguments ); 
		} else {
			 throw new Error ( "Script awaits input" );
		}
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
	_resolved : false,

	/**
	 * Hello.
	 */
	_oncompiled : function () {
		gui.Object.each ( this._compiler.inputs, function ( name, type ) {
			this.input.add ( type, this );
		}, this );
		return this._super._oncompiled ();
	},

	/**
	 * Ready to run?
	 * @overloads {edb.Function#_done}
	 * @returns {boolean}
	 */
	_done : function () {
		return this.input.done && this._super._done ();
	}


}, { // STATICS .....................................................................................
	
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
	assign : function ( func, thisp ) {
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
	invoke : function ( key, sig, log ) {
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
			 * button case the function takes a while to complete. 
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
	register : function ( e ) {
		this._log = {
			type : e.type,
			value : e.target.value,
			checked : e.target.checked
		};
		return this;
	},

	/**
	 * Experimental.
	 * @TODO sort of shadows edb.Function.get !!!!!!!!!!!!!!!!!!!!!!!!!
	 * @param {String} key
	 * @returns {edb.Script}
	 */
	get : function ( key ) {
		return this._scripts [ key ];
	},

	/**
	 * Experimental.
	 * @param {String} key
	 * @param {edb.Script} script
	 */
	set : function ( key, script ) {
		this._scripts [ key ] = script;
	},

	/**
	 * Mapping scripts to keys.
	 * @type {Map<String,edb.Script>}
	 */
	_scripts : Object.create ( null )

});


/**
 * Here it is.
 * @extends {edb.Function}
 */
edb.Tag = edb.Function.extend ( "edb.Tag", {

	/**
	 * Adding the "tag" directive.
	 * @overloads {edb.Template#compile}
	 * @param {String} source
	 * @param {HashMap<String,String>} directives
	 * @returns {edb.Function}
	 */
	compile : function ( source, directives ) {
		directives.tag = true;
		return this._super.compile ( source, directives );
	},

	/**
	 * Compiler implementation.
	 * @overwrites {edb.Function#_Compiler}
	 * @type {function}
	 */
	_Compiler : edb.TagCompiler


}, { // Recurring static ......................................

	/**
	 * Mapping src to compiled tags.
	 * @TODO Do we need to do this?
	 * @overwrites {edb.Function#_map}
	 * @type {Map<String,function>}
	 *
	_map : Object.create ( null )
	*/

});


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
		var val, html = "";
		if ( gui.Type.isDefined ( this [ att ])) {
			val = edb.Att.encode ( this [ att ]);
			html += att + "=\"" + val + "\" ";
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
		if ( this._olddom === null ) {
			this._first ( html );
		} else {
			this._next ( html );
		}
		this._updates.eachRelevant ( function ( update ) {
			update.update ();
			update.dispose ();
		});
		this._updates.dispose ();
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
	 * Heil Hitler.
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
	 * Attributes changed? Although declared as a private method, this actually gets 
	 * overloaded by edb.ScriptUpdate who needs to compute with the two extra arguments, 
	 * ids and css. We didn't want to create a hard dependancy on EDB templates...
	 * @see {edb.ScriptUpdate}
	 * @param {NodeList} newatts
	 * @param {NodeList} oldatts
	 * @param {String} css
	 * @returns {boolean}
	 */
	_attschanged : function ( newatts, oldatts, ids, css ) {
		return newatts.length !== oldatts.length || !Array.every ( newatts, function ( newatt ) {
			var oldatt = oldatts.getNamedItem ( newatt.name );
			/*
			if ( newatt.name === "oninput" ) {
				alert ( oldatt.value + "\n " + newatt.value + "\n" + ( oldatt !== null && oldatt.value === newatt.value ));
			}
			*/
			return oldatt && oldatt.value === newatt.value;
		});
	},
	
	/**
	 * Are element children candidates for "soft" sibling updates?
	 * 1) All children must be elements or whitespace-only textnodes
	 * 2) All elements must have a specified ID
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @return {boolean}
	 */
	_maybesoft : function ( newnode, oldnode ) {
		if ( newnode && oldnode ) {
			return this._maybesoft ( newnode ) && this._maybesoft ( oldnode );
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
edb.Update = gui.Class.create ( "edb.Update", Object.prototype, {
		
	/**
	 * Matches hard|atts|insert|append|remove
	 * @type {String}
	 */
	type : null,
	
	/**
	 * Identifies associated element in one of two ways:
	 * 1) It's the id of an element in this.window. Or if no id:
	 * 2) It's the $instanceid of a gui.Spirít in this.window
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
		var element = null;
		if ( gui.KeyMaster.isKey ( this.id )) {
			element = this.window.gui.get ( this.id ).element;
		} else {
			element = this.document.getElementById ( this.id );
		}
		if ( !element ) {
			throw new Error ( "No element to match: " + this.id );
		}
		return element;
	},

	/**
	 * Clean stuff up for what it's worth.
	 */
	dispose: function () {
		delete this.window;
		delete this.document;
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
	TYPE_REMOVE : "remove"
});


/**
 * Update attributes. Except for the ID which 
 * is required to be the same before and after.
 */
edb.AttsUpdate = edb.Update.extend ( "edb.AttsUpdate", {
	
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
	 * @overloads {edb.Update#dispose}
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
edb.HardUpdate = edb.Update.extend ( "edb.HardUpdate", {
	
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
		if ( this._beforeUpdate ( element )) {
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
edb.SoftUpdate = edb.Update.extend ( "edb.SoftUpdate", {
	
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
edb.InsertUpdate = edb.SoftUpdate.extend ( "edb.InsertUpdate", {
	
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
edb.AppendUpdate = edb.SoftUpdate.extend ( "edb.AppendUpdate", {
	
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
edb.RemoveUpdate = edb.SoftUpdate.extend ( "edb.RemoveUpdate", {
	
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
 * TODO: check if softupdate could mistarget the edb.ScriptUpdate.
 * TODO: move to updates folder.
 */
edb.ScriptUpdate = edb.Update.extend ( "edb.ScriptUpdate", {
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : "edbscript",

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
	 * @returns {edb.ScriptUpdate}
	 */
	setup : function ( spirit, selector, name, value, key ) {
		this._super.setup ();
		this._spirit = spirit;
		this._selector = selector;
		this._name = name;
		this._value = value;
		this._key = key;
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
					this._update ( element );
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
	_name : null,

	/**
	 * Attribute value (a generated method call)
	 * @type {String}
	 */
	_value : null,

	/**
	 * EDB script lookup key.
	 * TODO: use this to garbage collect unusable assignments.
	 * @type {String}
	 */
	_key : null,

	/**
	 * Update element.
	 * @param {Element} element
	 */
	_update : function ( element ) {
		var current = element.getAttribute ( this._name );
		if ( current && current.contains ( this._key )) {
			element.setAttribute ( this._name, this._value );
		} else {
			console.warn ( "Softupdate dysfunction? " + this._key + " not found in " + current );
			//console.log ( this._name, this._key );
			//console.error ( "Target was moved: " + this._selector ); // TODO: test with soft update
		}
	},

	/**
	 * Debug changes.
	 */
	_report : function () {
		this._super._report ( "edb.ScriptUpdate " + this._selector );
	}

});

/**
 * Injecting support for edb.ScriptUpdate into the UpdateManager.
 * TODO: refactor something and come up with a mixin strategy
 */
( function () {

	var method = edb.UpdateManager.prototype._attschanged;

	/**
	 * When an attribute update is triggered by a EDB poke, we verify that this was the *only* thing
	 * that changed and substitute the default update with a edb.ScriptUpdate. This will bypass the need 
	 * for an ID attribute on the associated element (without which a hardupdate would have happened).
	 * @overloads {edb.UpdateManager#_attschanged}
	 * @param {NodeList} newatts
	 * @param {NodeList} oldatts
	 * @param {String} css
	 * @returns {boolean}
	 */
	edb.UpdateManager.prototype._attschanged = function ( newatts, oldatts, ids, css ) {
		if ( method.apply ( this, arguments )) { // attributes changed...
			return !Array.every ( newatts, function ( newatt ) {
				var oldatt = oldatts.getNamedItem ( newatt.name );
				var newhit = gui.KeyMaster.extractKey ( newatt.value );

				if ( newatt.name === "oninput" ) { // TODO
					console.error ( oldatt.value + "\n " + newatt.value + "\n" + ( oldatt !== null && oldatt.value === newatt.value ));
				}
				
				if ( newhit ) {
					var oldhit = gui.KeyMaster.extractKey ( oldatt.value );
					var update = new edb.ScriptUpdate ( this._doc ).setup ( 
						this._spirit, css, oldatt.name, newatt.value, oldhit [ 0 ]
					);
					this._updates.collect ( update, ids );
					return true; // pretend nothing changed
				} else {
					return false;
				}
			}, this );
		} else {
			return false;
		}
	};

})();


/*
 * Register module.
 */
gui.module ( "edb", {
	
	/*
	 * Extending all spirits.
	 */
	mixins : {
		
		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {}
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
	 * @TODO this may be a bit silly...
	 * @TODO detect sandbox...
	 * @param {Window} context
	 */
	oncontextinitialize : function ( context ) {
		if ( context === gui.context ) { // TODO: better detect top context
			if ( edb.Template && edb.TemplateLoader ) { // hack to bypass the sandbox (future project)
				edb.Template.setImplementation ( 
					edb.Script, 
					"application/x-edbml",
					"application/edbml",
					"text/edbml",
					"edbml"
				);
			}
		}
	}
});