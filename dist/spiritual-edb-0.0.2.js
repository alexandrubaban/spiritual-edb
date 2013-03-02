/*
 * Spiritual EDB 0.0.2
 * (c) 2013 Wunderbyte
 * Spiritual is freely distributable under the MIT license.
 */



/*
 * Namepace object.
 */
var edb = gui.namespace ( "edb", {

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[namespace edb]";
	},

	BROADCAST_FUNCTION_LOADED : "broadcast-function-loaded",
	LIFE_SCRIPT_WILL_RUN : "life-script-will-run",
	LIFE_SCRIPT_DID_RUN	: "life-script-did-run",
	TICK_SCRIPT_UPDATE : "gui-tick-spiritscript-update",
	TICK_COLLECT_INPUT : "gui-tick-collect-input"

});


/**
 * EDB model base class. 
 * @see {edb.ObjectModel}
 * @see {edb.ArrayModel}
 * @see {edb.MapModel}
 */
edb.Model = function Model () {};
edb.Model.prototype = {
	
	/**
	 * Primary storage key (whatever serverside or localstorage).
	 * @type {String}
	 */
	$primaryKey : "id",
		
	/**
	 * Instance key (clientside session only).
	 * TODO: Safari on iPad would exceed call stack when this property was prefixed with "$" 
	 * because all getters would call $sub which would then get $instancekey (ie. overflow).
	 * Why was this only the case only for Safari iPad?
	 * @type {String}
	 */
	_instanceKey : null,
	
	/**
	 * Construct.
	 */
	onconstruct : function () {},
	
	/**
	 * TODO: what is this?
	 * Init (rename?).
	 */
	$init : function () {},

	/**
	 * Sub.
	 */
	$sub : function () {
		gui.Broadcast.dispatchGlobal ( null, gui.BROADCAST_DATA_SUB, this._instanceKey );
	},
	
	/**
	 * Pub.
	 */
	$pub : function () {
		gui.Broadcast.dispatchGlobal ( null, gui.BROADCAST_DATA_PUB, this._instanceKey );
	},
	
	/**
	 * Serialize to string.
	 * @param {boolean} pretty
	 */
	$serialize : function ( pretty ) {
		
		/*
		 * Avoid reading properties during this operation 
		 * because this may trigger endless $sub() invoke.
		 */
		var clone = JSON.parse ( JSON.stringify ( this ));
		Object.keys ( clone ).forEach ( function ( key ) {
			switch ( key.charAt ( 0 )) {
				case "$" :
				case "_" :
					delete clone [ key ];
					break;
			}
		});
		return JSON.stringify ( 
			clone, null, pretty ? "\t" : "" 
		);
	},
	
	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "edb.Model#toString :)";
	}
};


/**
 * DataObject.
 */
edb.ObjectModel = gui.Exemplar.create ( edb.Model.prototype, {
	
	/**
	 * Hello.
	 */
	__construct__ : function ( data ) {
		this._instanceKey = gui.KeyMaster.generateKey ();
		var type = gui.Type.of ( data );
		switch ( type ) {
			case "object" :
			case "undefined" :
				edb.ObjectModel.approximate ( this, data );
				this.onconstruct ();
				break;
			default :
				throw new TypeError ( 
					"Unexpected argument of type " + 
					type.toUpperCase () + ":\n" + data 
				);
		}
	}


}, { // recurring static fields .........................................
	
	__name__ : "DataObject",
	__data__ : true
	
	
}, { // static fields ............................................

	/**
	 * Simplistic proxy mechanism: call $sub() on get property and $pub() on set property.
	 * @param {object} handler The object that intercepts properties (the edb.ObjectModel)
	 * @param {object} proxy The object whose properties are being intercepted (the JSON data)
	 */
	approximate : function ( handler, proxy ) {
		var def = null;
		proxy = proxy || {};
		var model = {}; // mapping properties that redefine from "function" to "object"
		this._definitions ( handler ).forEach ( function ( key ) {
			def = handler [ key ];
			switch ( gui.Type.of ( def )) {

				/*
				 * Method type functions are skipped, constructors get instantiated. 
				 * Similar (named) property in proxy becomes the constructor argument.
				 * TODO: How to universally differentiate constructors from methods?
				 */
				case "function" :
					
					/*
					 * TODO: this for edb.MapModel
					 */
					if ( gui.Type.isConstructor ( def )) {
						var C = def;
						model [ key ] = new C ( proxy [ key ]);

						/*
						hotfix [ key ] = true;
						if ( key === "children" ) {
							//alert ( JSON.stringify ( proxy [ key ]));
							alert ( "ObjectModel " + handler [ key ][ 0 ]);
						}
						*/
					}
					break;
				
				/*
				 * TODO: Consider new instance of edb.ObjectModel by default.
				 * TODO: Cosnsider how to guess an object apart from a Map.
				 */
				case "object" :
					console.warn ( "TODO: approximate object: " + key );
					console.warn ( JSON.stringify ( def ));
					break;
					
				/*
				 * TODO: Consider new instance of edb.ArrayModel by default.
				 */
				case "array" :
					console.warn ( "TODO: approximate array: " + key );
					console.warn ( JSON.stringify ( def ));
					break;
					
				/*
				 * Simple properties copied from handler to 
				 * proxy. Strings, numbers, booleans etc.
				 */
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
					get : function () {
						this.$sub ();
						return model [ key ] || proxy [ key ];
					},
					set : function ( value ) {
						var target = model [ key ] ? model : proxy;
						target [ key ] = value;
						this.$pub ();
					}
				});
		});
	},

	/**
	 * Hello.
	 * @param {object} handler
	 * @returns {Array<String>}
	 */
	_definitions : function ( handler ) {
		var keys = [];
		function fix ( key ) {
			if ( !gui.Type.isDefined ( Object.prototype [ key ])) {
				if ( !gui.Type.isDefined ( edb.Model.prototype [ key ])) {
					if ( !key.startsWith ( "_" )) {
						keys.push ( key );
					}
				}
			}
		}
		for ( var key in handler ) {
			fix ( key );
		}
		return keys;
	}
});


/**
 * Array-like data model. Aliased as Array.model ();
 */
edb.ArrayModel = gui.Exemplar.create ( Array.prototype, {
	
	/**
	 * Autoboxed data model.
	 * @type {function} model constructor (or filter function)
	 */
	$contentmodel : null,

	/**
	 * Secret constructor.
	 */
	__construct__ : function () {		
		this._instanceKey = gui.KeyMaster.generateKey ();
		/*
		 * Autoboxing?
		 * TODO: WHAT EXACTLY IS THIS STEP DOING?
		 */
		var C = this.constructor;
		if ( C.__content__ ) {
			this.$contentmodel = C.__content__;
			C.__content__ = null;
		}
		/*
		 * TODO: sample for type Object or Array and autocast autoboxing!
		 */
		if ( gui.Type.isDefined ( arguments [ 0 ])) {
			// accept one argument (an array) or use Arguments object as an array
			var input = [];
			if ( gui.Type.isArray ( arguments [ 0 ])) {
				input = arguments [ 0 ];
			} else {
				Array.forEach ( arguments, function ( arg ) {
					input.push ( arg );
				});
			}
			// TODO: this less cryptic
			var boxer = this.$contentmodel || this.$cm;
			if ( gui.Type.isFunction ( boxer )) {
				input.forEach ( function ( o, i ) {
					if ( o !== undefined ) { // why can o be undefined in Firefox?
						if ( !o._instanceKey ) { // TODO: use instanceOf model
							var Model = boxer;
							if ( !gui.Type.isConstructor ( Model )) { // model constructor or filter function?
								Model = boxer ( o ); // was: if ( !model.__data__ )...
							}
							o = new Model ( o );
						}
						Array.prototype.push.call ( this, o ); // bypass $pub() setup
					}
				}, this );
			}
		}
		// proxy methods and invoke non-secret constructor
		edb.ArrayModel.approximate ( this, {});
		this.onconstruct ();
	}
	
	
}, { // recurring static fields .........................................
	
	__name__ : "DataList",
	__data__ : true,
	__content__ : null


}, { // static fields ............................................

	/**
	 * Simplistic proxy mechanism: call $sub() on get property and $pub() on set property.
	 * @param {object} handler The object that intercepts properties (the edb.ArrayModel)
	 * @param {object} proxy The object whose properties are being intercepted (raw JSON data)
	 */
	approximate : function ( handler, proxy ) {
		
		var def = null;
		proxy = proxy || {};	
		this._definitions ( handler ).forEach ( function ( key ) {
			def = handler [ key ];
			switch ( gui.Type.of ( def )) {
				case "function" :
					break;
				case "object" :
				case "array" :
					console.warn ( "TODO: complex stuff on edb.ArrayModel :)" );
					break;
				/*
				 * Simple properties copied from handler to 
				 * proxy. Strings, numbers, booleans etc.
				 */
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
				get : function () {
					this.$sub ();
					return proxy [ key ];
				},
				set : function ( value ) {
					proxy [ key ] = value;
					this.$pub ();
				}
			});
		});
	},

	/**
	 * Hello.
	 * @param {object} handler
	 * @returns {Array<String>}
	 */
	_definitions : function ( handler ) {
		var keys = [];
		function fix ( key ) {
			if ( !gui.Type.isNumber ( gui.Type.cast ( key ))) {
				if ( !gui.Type.isDefined ( Array.prototype [ key ])) {
					if ( !gui.Type.isDefined ( edb.Model.prototype [ key ])) {
						if ( !key.startsWith ( "_" )) {
							keys.push ( key );
						}
					}
				}
			}
		}
		for ( var key in handler ) {
			fix ( key );
		}
		return keys;
	}
});

/*
 * Building edb.ArrayModel.prototype...
 */
( function generatecode () {

	"use strict";
	
	/*
	 * Copy edb.Model methods and properties (manually because we extend from Array).
	 */
	Object.keys ( edb.Model.prototype ).forEach ( function ( def ) {
		this [ def ] = edb.Model.prototype [ def ];
	}, this );
	
	/*
	 * Whenever the list is inspected or traversed, method $sub() should be invoked.
	 * TODO: make this mechanism public for easy expando
	 */
	[
		"filter", 
		"forEach", 
		"every", 
		"map", 
		"some", 
		"indexOf", 
		"lastIndexOf"
	].forEach ( function ( method ) {
		this [ method ] = function () {
			var result = Array.prototype [ method ].apply ( this, arguments );
			this.$sub ();
			return result;
		};
	}, this );
	
	/*
	 * Whenever the list changes content or structure, method $pub() should be invoked.
	 * TODO: Alwasy validate that added entries match the interface of autoboxed type...
	 * TODO: make this mechanism public for easy expando
	 */
	[
		"push",
		"pop", 
		"shift", 
		"unshift", 
		"splice", 
		"reverse" 
	].forEach ( function ( method ) {
		this [ method ] = function () {
			var result = Array.prototype [ method ].apply ( this, arguments );
			this.$pub ();
			return result;
		};
	}, this );
	
	/*
	 * TODO: This is wrong on so many...
	 * @param {edb.ArrayModel} other
	 */
	this.concat = function ( other ) {
		var clone = new this.constructor (); // must not construct() the instance!
		this.forEach ( function ( o ) {
			clone.push ( o );
		});
		other.forEach ( function ( o ) {
			clone.push ( o );
		});
		return clone;
	};
	
}).call ( edb.ArrayModel.prototype );


// TODO



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
	 * The Script SRC must be set before spirit.onenter() 
	 * to automatically load when spirit enters the DOM.
	 * @type {String}
	 */
	src : null,

	/**
	 * True when there's a script; and when it's loaded.
	 * @todo Should there also be a "loading" boolean?
	 * @todo Should all this happen via life events?
	 * @type {boolean}
	 */
	loaded : true,

	/**
	 * Automatically run the script on spirit.onenter()? 
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
	 * Waiting for onenter() to load the script. For some reason.
	 * @param {gui.Life} life
	 */
	onlife : function ( life ) {
		if ( life.type === gui.LIFE_ENTER ) {
			this.load ( this.src );
		}
	},

	/**
	 * Mapping imported functions to declared variable names.
	 * @returns {Map<String,function>}
	 */
	functions : function () {
		return this._script.functions;
	},

	/**
	 * Returns something to resolve expected script input (edb.Data).
	 * returns {edb.Input}
	 */
	input : function () {
		return this._script.input;
	},

	/**
	 * Load script from SRC. This happens async unless the SRC 
	 * points to a script embedded in the spirits own document 
	 * (and unless script has already been loaded into context).
	 * @param {String} src 
	 * @param @optional {String} type Script mimetype (eg "text/edbml")
	 */
	load : function ( src, type ) {
		var context = this.spirit.window;
		edb.Template.load ( context, src, type || this.type, function ( script ) {
			this._compiled ( script );
		}, this );
	},

	/**
	 * Compile script from source text and run it when ready.
	 * @param {String} source Script source code
	 * @param @optional {String} type Script mimetype (eg "text/edbml")
	 * @param @optional {HashMap<String,String>} directives Optional compiler directives
	 */
	compile : function ( source, type, directives ) {
		var context = this.spirit.window;
		edb.Template.compile ( context, source,  type || this.type, directives, function ( script ) {
			this._compiled ( script );
		}, this );
	},

	/**
	 * Run script (with implicit arguments) and write result to DOM.
	 * @see {gui.SandBoxView#render}
	 */
	run : function () {
		if ( this._script ) {
			this._script.pointer = this.spirit; // TODO!
			this.write ( 
				this._script.run.apply ( 
					this._script, 
					arguments 
				)
			);
		} else {
			console.warn ( "Running uncompiled script" );
		}
	},
	
	/**
	 * Write the actual HTML to screen. You should probably only 
	 * call this method if you are producing your own markup 
	 * somehow, ie. not using EDBML templates out of the box. 
	 * @todo Only do something if string argument has diffed 
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
			( this._latest = html ) !== this._latest // @todo Support this kind of arg...
		);

		/*
		 * Time consume detected. Let's either not do this or 
		 * refactor into combo of tick, broadcast and action. 
		 * (no dom traversal should be involved in what it is)
		 */
		// this.spirit.action.dispatchGlobal ( gui.ACTION_DOCUMENT_FIT ); // emulate seamless iframes (?)
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

	/**
	 * Script compiled. Let's do this.
	 * @todo life-event should probably go here...
	 * @param {edb.Script} script
	 */
	_compiled : function ( script ) {
		this._script = script;
		this.loaded = true;
		if ( this.debug ) {
			this._script.debug ();
		}
		if ( this.autorun ) {
			this.run ();
		}
	}


}, { // STATICS .........................................................................

	/**
	 * Construct when spirit constructs.
	 * @type {boolean}
	 */
	lazy : false

});



/**
 * Note: This plugin may be used standalone, so don't reference any spirits around here.
 * @todo formalize how this is supposed to be clear
 */
edb.OutputPlugin = gui.Plugin.extend ( "edb.OutputPlugin", {

	/**
	 * Dispatch data as type (eg. instantiate model with JSON and publish the instance on page).
	 * @param {object} data
	 * @param @optional {function|String} type edb.Model constructor or "my.ns.MyModel"
	 */
	dispatch : function ( data, Type ) {
		var input = this._format ( data, Type );
		if ( input instanceof edb.Input ) {
			if ( input.type ) {
				input.type.output = input; // TODO: RENAME this abomination
				gui.Broadcast.dispatchGlobal ( 
					this.sandboxed ? null : this.spirit, 
					gui.BROADCAST_OUTPUT, 
					input 
				);
			} else {
				throw new Error ( "edb.Input type is " + input.type );
			}
		} else {
			throw new TypeError ( "Not an instance of edb.Input: " + input );
		}
	},

	/**
	 * @deprecated
	 */
	type : function () {
		throw new Error ( "deprecated" );
	},

	
	// PRIVATES .........................................................................
	
	/**
	 * Wrap data in edb.Input before we output.
	 * TODO: DON'T AUTOMATE MODELS, let's just output JSON objects...
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
			} else if ( !data._instanceKey ) { // TODO: THE WEAKNESS
				switch ( gui.Type.of ( data )) {
					case "object" :
						Type = Object.model ();
						break;
					case "array" :
						Type = Array.model ();
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
	 * Lookup edb.Model constructor for argument (if not it is already).
	 * @todo Check that it is actually an edb.Model thing...
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
				console.error ( this + ": expected edb.Model constructor (not an object)" );
				break;
		}
		if ( !type ) {
			throw new TypeError ( "The type \"" + arg + "\" does not exist" );
		}
		return type;
	}

});


/**
 * Tracking EDB input.
 * @extends {gui.Tracker} Note: Doesn't use a lot of super...
 */
edb.InputPlugin = gui.Tracker.extend ( "edb.InputPlugin", {
   
	/**
	 * True when one of each expected input type has been collected.
	 * @type {boolean}
	 */
	done : true,
	
	/**
	 * Listing latest inputs, one of each registered type.
	 * @type {Array<edb.Input>} 
	 */
	latest : null,
	
	/**
	 * Mapping data types (edb.Model constructors) to input handlers. 
	 * @type {WeakMap<function,object>}
	 */
	_weakmap : null,
	
	/**
	 * Registered input types (because no available iterator for weakmaps).
	 * TODO: We now have https://bugzilla.mozilla.org/show_bug.cgi?id=725909#c12
	 * @type
	 */
	_types : null,
		
	/**
	 * Add one or more input handlers.
	 * TODO: add support for "type"
	 * @param {object} arg
	 * @param @optional {object} handler implements InputListener (defaults to this)
	 * @returns {gui.Spirit}
	 */
	add : function ( arg, handler ) {
		this.done = false; // TODO: check has() already around here?
		this.latest = this.latest || [];
		this._types = this._types || [];
		this._weakmap = this._weakmap || new WeakMap ();
		handler = handler ? handler : this.spirit;
		var maybe = [];
		var types = this._breakdown ( arg );
		types.forEach ( function ( type, index ) {
			if ( !this._weakmap.get ( type )) {
				this._weakmap.set ( type, []);
			}
			this._weakmap.get ( type ).push ( handler );
			if ( this._types.indexOf ( type ) === -1 ) {
				this._types.push ( type );
				if ( this._types.length === 1 ) {
					edb.Input.add ( this ); // await future output of this type
				}
				if ( type.output instanceof edb.Input ) { // type has been output?
					if ( !this.spirit || this.spirit.life.ready ) {
						var tick = edb.TICK_COLLECT_INPUT;
						var sig = this.context.gui.signature;
						gui.Tick.one ( tick, this, sig ).dispatch ( tick, 0, sig );
					} else {
						this.spirit.life.add ( gui.LIFE_READY, this );
					}
				}
			}
		}, this );
		
		return this.spirit;
	},

	/**
	 * Remove one or output handlers.
	 * @todo various updates after this operation
	 * @param {object} arg
	 * @param @optional {object} handler implements InputListener (defaults to this)
	 * @returns {gui.Spirit}
	 */
	remove : function ( arg, handler ) {
		handler = handler ? handler : this;
		this._breakdown ( arg ).forEach ( function ( type ) {
			var index = this._types.indexOf ( type );
			if ( index >-1 ) {
				this._types.remove ( index ); // TODO; rebuild and stuff! plus remove broadcast handler if zero
				if ( handler !== this ) {
					throw "not implemented"; // TODO
				}
			}
		}, this );
		return this.spirit;
	},
	
	/**
	 * Get data for latest input of type.
	 * @param {function} type
	 * @returns {object}
	 */
	get : function ( type ) {
		var data;
		if ( this.latest ) {
			this.latest.every ( function ( input ) {
				if ( input.type === type ) {
					data = input.data;
				}
				return data === undefined;
			});
		}
		return data;
	},
	
	/**
	 * Route broadcasted input to handlers.
	 * @param {gui.Broadcast} b
	 */
	onbroadcast : function ( b ) {
		if ( b.type === gui.BROADCAST_OUTPUT ) {
			this._maybeinput ( b.data );
		}
	},
	
	/**
	 * In this case, input for spirit exists before the spirit was created. 
	 * We normally trigger the spirits builder on "attach" (because a build  
	 * will nuke all descendant spirits anyway) but in this case we need 
	 * to wait for "ready" so that inline builder script can register first. 
	 * @param {gui.SpiritLife} life
	 */
	onlife : function ( life ) {
		if ( life.type === gui.LIFE_READY ) {
			this._todoname ();
		}
	},
	
	/**
	 * Handle tick.
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {
		if ( tick.type === edb.TICK_COLLECT_INPUT ) {
			this._todoname ();
		}
	},

	/**
	 * TODO: think about this...
	 * @overwrites {gui.Plugin#destruct}
	 */
	destruct : function () {
		this._super.destruct ();
		gui.Tick.remove ( edb.TICK_COLLECT_INPUT, this, this.context.gui.signature );
		if ( this._types ) {
			this._types.forEach ( function ( type ) {
				this._weakmap.del ( type );
			}, this );
			delete this._types;
		}
		delete this._weakmap;
	},

	
	// PRIVATES .........................................................................................
	
	/*
	 * Collect all types before evaluating this.done; make sure 
	 * that all required types are served in a single array, 
	 * otherwise script.run () may be invoked prematurely.
	 * TODO: Update the above to reflect modern API
	 */
	_todoname : function () {
		this._types.forEach ( function ( type ) {
			if ( type.output instanceof edb.Input ) {
				this._maybeinput ( type.output );
			}
		}, this );
	},

	/**
	 * Delegate input to handlers if type matches expected.
	 * @param {edb.Input} input
	 */
	_maybeinput : function ( input ) {
		var type = input.type;
		if ( this._types.indexOf ( type ) >-1 ) {
			// remove old entry (no longer latest)
			this.latest.every ( function ( collected, i ) {
				var match = ( collected.type === type );
				if ( match ) {
					this.latest.remove ( i );
				}
				return !match;
			}, this );
			// add latest entry and flag all accounted for
			this.done = ( this.latest.push ( input ) === this._types.length );
			// handlers updated even when not all accounted for
			this._weakmap.get ( type ).forEach ( function ( handler ) {
				handler.oninput ( input );
			});
		}
	},
	
	/**
	 * Resolve argument into array of one or more function constructors (data types).
	 * @param {object} arg
	 * @returns {Array<function>}
	 */
	_breakdown : function ( arg ) {
		var result = null;
		if ( gui.Type.isArray ( arg )) {
			result = this._breakarray ( arg );
		} else {
			result = this._breakother ( arg );
		}
		return result;
	},
	
	/**
	 * @param {Array<object>}
	 * @returns {Array<function>}
	 */
	_breakarray : function ( array ) {
		return array.map ( function ( o ) {
			var res = null;
			switch ( gui.Type.of ( o )) {
				case "function" :
					res = o;
					break;
				case "string" :
					res = gui.Object.lookup ( o, this.context );
					break;
				case "object" :
					console.error ( this + ": expected function (not object)" );
					break;
			}
			return res;
		}, this );
	},
	
	/**
	 * @param {object} arg
	 * @returns {Array<function>}
	 */
	_breakother : function ( arg ) {
		var result = null;
		switch ( gui.Type.of ( arg )) {
			case "function" :
				result = [ arg ];
				break;
			case "string" :
				result = this._breakarray ( arg.split ( " " ));
				break;
			case "object" :
				console.error ( this + ": expected function (not object)" );
				break;
		}
		return result;
	}
});


/**
 * Spirit input.
 * @param {object} data
 * @param {function} type
 */
edb.Input = function SpiritInput ( type, data ) {
	this.type = type || null;
	this.data = data || null;
};

edb.Input.prototype = {
	
	/**
	 * Input type (is a function constructor)
	 * @type {function}
	 */
	type : null,
	
	/**
	 * Input data (is an instance of this.type)
	 * @type {object} data
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
 * @static
 * TODO: out of global
 * Subscribe handler to input.
 * @param {object} handler Implements InputListener
 */
edb.Input.add = function ( handler ) {
	gui.Broadcast.addGlobal ( gui.BROADCAST_OUTPUT, handler );
};

/**
 * @static
 * TODO: out of global
 * Unsubscribe handler from input.
 * @param {object} handler Implements InputListener
 */
edb.Input.remove = function ( handler ) {
	gui.Broadcast.removeGlobal ( gui.BROADCAST_OUTPUT, handler );
};


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
	
	/**
	 * Map the attribute "gui.debug" to simply "debug".
	 * @todo Deprecate this silliness at some point...
	 */
	config : {
		map : {
			"debug" : "debug"
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
	 * inside a parent spirit, we target the parent spirits {edb.ScriptPlugin}. To avoid 
	 * such a scenario, perhaps scripts might be placed in the document HEAD section.
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
 * Spirit of the service.
 * @todo rename @type to @model
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
	},

	/**
	 * TODO: enable this pipeline stuff
	 * @param {edb.Input} input
	 *
	oninput : function ( input ) {
		this._super.oninput ( input );
		if ( this.att.get ( "type" ) && this.input.done ) {
			this._pipeline ();
		}
	},
	*/
	
	
	// PRIVATES ...............................................................................................
	
	/**
	 * If both input type and output type is specified, the service will automatically output new data when all 
	 * input is recieved. Input data will be supplied as constructor argument to output function; if A and B is 
	 * input types while C is output type, then input instance a and b will be output as new C ( a, b ) 
	 * @todo Implement support for this some day :)
	 */
	_pipeline : function () {		
		console.error ( "TODO: might this be outdated???" );
		/*
		 * TODO: use method apply with array-like arguments substitute pending universal browser support.
		 * https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/apply#Description
		 */
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
	
	/**
	 * Return data for index. Index follows the order of which the input handler was added, not in which data was recieved. 
	 * Alright, so this implies that first index will return object of type MyData if handler for this type was added first.
	 * @param {number} index
	 * @returns {object}
	 */
	_arg : function ( index ) {
		var type = this.input._types [ index ]; // function type
		return this.input.get ( type ); // instance of function
	}
});


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
 * @param {gui.Spirit} spirit
 */
edb.UpdateManager = function UpdateManager ( spirit ) {
	this._keyid = spirit.dom.id () || spirit.spiritkey;
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
	 * 2) Spirits spiritkey (if no element ID).
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
edb.Update = gui.Exemplar.create ( "edb.Update", Object.prototype, {
		
	/**
	 * Matches hard|atts|insert|append|remove
	 * @type {String}
	 */
	type : null,
	
	/**
	 * Identifies associated element in one of two ways:
	 * 1) It's the id of an element in this.window. Or if no id:
	 * 2) It's the "spiritkey" of a gui.Spirít in this.window
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
	 * Secret constructor.
	 * @param {Document} doc
	 */
	__construct__ : function ( doc ) {
		this.onconstruct ( doc );
	},
	
	/**
	 * Invoked when update is newed up.
	 * @param {Document} doc
	 */
	onconstruct : function ( doc ) {
		this.document = doc;
		this.window = doc.defaultView;
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
		 * may be indexed by "spiritkey" if no ID attribute is specified.
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
	
}, {}, {
	
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
		if ( current.contains ( this._key )) {
			if ( element.spirit ) {
				element.spirit.att.set ( this._name, this._value );
			} else {
				element.setAttribute ( this._name, this._value );
			}
		} else {
			console.error ( "Target was moved: " + this._selector ); // TODO: test with soft update
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


/**
 * EDB processing instruction.
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
 * Tracking compiler state.
 * @todo Comments all over.
 */
edb.State = function () {
	this.conf = [];
};

edb.State.prototype = {
	mode : edb.State.MODE_JS,
	body : '"use strict";\n',
	peek : false,
	poke : false,
	cont : false,
	adds : false,
	func : null,
	conf : null,
	skip : 0,
	last : 0,
	spot : 0,
	indx : 0
};


// Static ..........................

edb.State.MODE_JS = "js";
edb.State.MODE_HTML = "html";
edb.State.MODE_TAG = "tag";


/**
 * Compile EDB function.
 */
edb.FunctionCompiler = gui.Exemplar.create ( Object.prototype, {

	/**
	 * Compiled script source.
	 * @type {String}
	 */
	source : null,
	
	/**
	 * Arguments expected for compiled function. 
	 * @type {Array<String>}
	 */
	params : null,

	/**
	 * Required functions. Mapping src to variable name.
	 * @type {Map<String,String>}
	 */
	functions : null,

	/**
	 * Required tags. Mapping src to variable name.
	 * @type {Map<String,String>}
	 */
	tags : null,

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
	 * @param {Window} scope Function to be declared in scope of this window (or worker context).
	 * @param @optional {boolean} fallback
	 * @returns {function}
	 */
	compile : function ( scope ) {
		var result = null;
		this.params = [];
		this.tags = Object.create ( null );
		this.functions = Object.create ( null );
		this._vars = [];
		var head = {
			declarations : Object.create ( null ), // Map<String,boolean>
			definitions : [] // Array<String>
		};
		this.sequence.forEach ( function ( step ) {
			this.source = this [ step ] ( this.source, head );
		}, this );
		try {
			result = this._convert ( scope, this.source, this.params );
			this.source = this._source ( this.source, this.params );
		} catch ( exception ) {
			result = this._fail ( scope, exception );
		}
		return result;
	},

	/**
	 * Sign generated methods with a gui.signature key. This allows us to evaluate assigned 
	 * functions in a context different to where the template HTML is used (sandbox scenario).
	 * @param {String} signature
	 * @returns {edb.ScriptCompiler}
	 */
	sign : function ( signature ) {
		this._signature = signature;
		return this;
	},
	

	// PRIVATE ..............................................................................
	
	/**
	 * (Optionally) stamp a signature into edb.ScriptCompiler.invoke() callbacks.
	 * @type {String} 
	 */
	_signature : null,

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
		var atts = pi.atts;
		switch ( pi.type ) {
			case "param" :
				this.params.push ( atts.name );
				break;
			case "function" :
				this.functions [ atts.name ] = atts.src;
				break;
			case "tag" :
				var name = atts.src.split ( "#" )[ 1 ];
				if ( name ) {
					this.tags [ name ] = atts.src;
				} else {
					throw new Error ( "Missing #identifier: " + atts.src );
				}
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
		gui.Object.each ( this.functions, function ( name, func ) {
			head.declarations [ name ] = true;
			funcs.push ( name + " = functions [ '" + name + "' ];\n" );
		}, this );
		if ( funcs [ 0 ]) {
			head.definitions.push ( 
				"( function lookup ( functions ) {\n" +
				funcs.join ( "" ) +
				"})( this.script.functions ());" 
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
			vars += ", " + name + " = null";
		});
		var html = "var Out = edb.Out, Att = edb.Att, Tag = edb.Tag, out = new Out (), att = new Att ()" + vars +";\n";
		head.definitions.forEach ( function ( def ) {
			html += def +"\n";
		});
		return html + script;
	},

	/**
	 * Compile EDBML to function source.
	 * @param {String} script
	 * @param {What?} head
	 * @returns {String}
	 */
	_compile : function ( script, head ) {
		var state = new edb.State ();
		script.split ( "\n" ).forEach ( function ( line, index ) {
			this._compileline ( state, line, index );
		}, this );
		state.body += ( state.mode === "html" ? "';" : "" ) + "\nreturn out.write ();";
		return this._format ( state.body );
	},

	/**
	 * Compile single line.
	 * @param {edb.State} state
	 * @param {String} line
	 * @param {number} index
	 */
	_compileline : function ( state, line, index ) {
		line = line.trim (); // beware of whitespace sensitive language
		state.last = line.length - 1;
		state.adds = line.charAt ( 0 ) === "+";
		state.cont = state.cont || ( state.mode === "html" && state.adds );
		if ( line.length > 0 ) {
			if ( index > 0 ) {
				if ( state.mode === "html" ) {	
					if ( !state.cont ) {
						state.body += "';\n";
						state.mode = "js";
					}
				} else {
					state.body += "\n";
				}
			}
			state.cont = false;
			Array.forEach ( line, function ( c, i ) {
				this._compilechar ( state, c, i, line );
			}, this );
		}
	},

	/**
	 * Compile single character.
	 * @param {edb.State} state
	 * @param {String} c
	 * @param {number} i
	 * @param {String} line
	 */
	_compilechar : function ( state, c, i, line ) {
		switch ( state.mode ) {
			case "tag" :
				this._compiletag ( state, c, i, line );
				break;
			case "html" :
				this._compilehtml ( state, c, i, line );
				break;
			default : // @todo case "js"
				this._compilescript ( state, c, i, line );
				break;
		}
		if ( state.skip-- <= 0 ) {
			if ( state.poke ) {
				state.func += c;
			} else {
				if ( state.mode !== "tag" ) {
					state.body += c;
				}
			}
		}
	},

	/**
	 * Compile character as HTML.
	 * @param {edb.State} state
	 * @param {String} c
	 * @param {number} i
	 * @param {String} line
	 */
	_compilehtml : function ( state, c, i, line ) {
		switch ( c ) {
			case "{" :
				if ( state.peek || state.poke ) {}
				break;
			case "}" :
				if ( state.peek ) {
					state.peek = false;
					state.skip = 1;
					state.body += ") + '";
				}
				if ( state.poke ) {
					state.body = this._inject ( state.body, state.spot, state.func, state.indx++ );
					state.poke = false;
					state.func = null;
					state.skip = 1;
				}
				break;
			case "$" :
				if ( !state.peek && !state.poke && this._ahead ( line, i, "{" )) {
					state.peek = true;
					state.skip = 2;
					state.body += "' + (";
				}
				break;
			case "#" :
				if ( !state.peek && !state.poke && this._ahead ( line, i, "{" )) {
					state.poke = true;
					state.func = "";
					state.skip = 2;
				}
				break;
			case "+" :
				switch ( i ) {
					case 0 :
						state.skip = state.adds ? 1 : 0;
						break;
					case state.last :
						state.cont = true;
						state.skip = 1;
						break;
				}
				break;
			case "'" :
				if ( !state.peek && !state.poke ) {
					state.body += "\\";
				}
				break;
			case "@" :
				this._atthtml ( state, line, i );
				break;
		}
	},

	/**
	 * Compile character as script.
	 * @param {edb.State} state
	 * @param {String} c
	 * @param {number} i
	 * @param {String} line
	 */
	_compilescript : function ( state, c, i, line ) {
		switch ( c ) {
			case "<" :
				if ( i === 0 ) {
					var tag;
					if (( tag = this._tagstart ( line ))) {
						state.mode = "tag";
						state.body += "out.html += Tag.get ( '#ole', window )( function ( out ) {";
						var elem = new gui.HTMLParser ( document ).parse ( line + "</ole>" )[ 0 ];
						var atts = JSON.stringify ( gui.AttPlugin.getmap ( elem ));
						state.conf.push ( atts );
					} else if (( tag = this._tagstop ( line ))) {
						state.body += "}, " + state.conf.pop () + " );";
						state.mode = "tag";
						state.conf = null;
					} else {
						state.mode = "html";
						state.spot = state.body.length - 1;
						state.body += "out.html += '";
					}
				}
				break;
			case "@" :
				this._attscript ( state, line, i );
				break;
		}
	},

	/**
	 * Compile character as tag.
	 * @param {edb.State} state
	 * @param {String} c
	 * @param {number} i
	 * @param {String} line
	 */
	_compiletag : function ( state, c, i, line ) {
		switch ( c ) {
			case ">" :
				//state.tagt = false;
				state.mode = "js";
				state.skip = 1;
				break;
		}
	},

	/*
	 * Parse @ notation in markup. 
	 * @param {String} line
	 * @param {number} i
	 */
	_atthtml : function ( state, line, i ) {
		var attr = edb.FunctionCompiler._ATTREXP;
		var rest, name, dels, what;
		if ( this._behind ( line, i, "@" )) {}
		else if ( this._ahead ( line, i, "@" )) {
			state.body += "' + att._all () + '";
			state.skip = 2;
		} else {
			rest = line.substring ( i + 1 );
			name = attr.exec ( rest )[ 0 ];
			dels = this._behind ( line, i, "-" );
			what = dels ? "att._pop" : "att._out";
			state.body = dels ? state.body.substring ( 0, state.body.length - 1 ) : state.body;
			state.body += "' + " + what + " ( '" + name + "' ) + '";
			state.skip = name.length + 1;
		}
	},

	/*
	 * Parse @ notation in script.
	 * TODO: preserve email address and allow same-line @
	 * @param {String} line
	 * @param {number} i
	 */
	_attscript : function ( state, line, i ) {
		var attr = edb.FunctionCompiler._ATTREXP;
		var rest, name;
		if ( this._behind ( line, i, "@" )) {} 
		else if ( this._ahead ( line, i, "@" )) {
			state.body += "var att = new edb.Att ();";
			state.skip = 2;
		} else {
			rest = line.substring ( i + 1 );
			name = attr.exec ( rest )[ 0 ];
			if ( name ) {
				state.body += rest.replace ( name, "att['" + name + "']" );
				state.skip = rest.length;
			} else {
				throw "Bad @name: " + rest;
			}
		}
	},

	_tagstart : function ( line ) {
		return this._ahead ( line, 0, "ole" );
	},

	_tagstop : function ( line ) {
		return this._ahead ( line, 0, "/ole>" );
	},

	/**
	 * Generate and inject poke function into main function body.
	 * @param {String} body
	 * @param {number} spot
	 * @param {String} func
	 * @returns {String}
	 */
	_inject : function ( body, spot, func, index ) {
		var sig = this._signature ?  ( ", &quot;" + this._signature + "&quot;" ) : "";
		return (
			body.substring ( 0, spot ) + "\n" + 
			"var __edb__" + index + " = edb.Script.assign ( function ( value, checked ) { \n" +
			func + ";\n" +
			"}, this );" +
			body.substring ( spot ) +
			"edb.Script.register ( event ).invoke ( &quot;\' + __edb__" + index + " + \'&quot;" + sig + " );"
		);
	},
	
	/**
	 * Evaluate script to invocable function.
	 * @param {Window} scope
	 * @param {String} script
	 * @param @optional (Array<String>} params
	 * @returns {function}
	 */
	_convert : function ( scope, script, params ) {
		var args = "";
		if ( gui.Type.isArray ( params )) {
			args = params.join ( "," );
		}
		return new scope.Function ( args, script );
	},
	
	/**
	 * Line text at index equals string?
	 * @param {String} line
	 * @param {number} index
	 * @param {String} string
	 * @returns {boolean}
	 */
	_ahead : function ( line, index, string ) {
		var i = index + 1, l = string.length;
		return line.length > index + l && line.substring ( i, i + l ) === string;
	},

	/**
	 * Line text before index equals string?
	 * @param {String} line
	 * @param {number} index
	 * @param {String} string
	 * @returns {boolean}
	 */
	_behind : function ( line, index, string ) {
		var length = string.length, start = index - length;
		return start >= 0 && line.substr ( start, length ) === string;
	},

	/**
	 * Compilation failed. Output a fallback rendering.
	 * @param {Window} scope
	 * @param {Error} exception
	 * @returns {function}
	 */
	_fail : function ( scope, exception ) {
		if ( !this._failed ) {
			this._failed = true;
			this._debug ( scope, this._format ( this.source ));
			this.source = "<p class=\"error\">" + exception.message + "</p>";
			return this.compile ( scope, true );
		} else {
			throw ( exception );
		}
	},

	/**
	 * Transfer broken script source to script element and import on page.
	 * Hopefully this will allow the developer console to aid in debugging.
	 * TODO: Fallback for IE9 (see http://stackoverflow.com/questions/7405345/data-uri-scheme-and-internet-explorer-9-errors)
	 * TODO: Migrate this stuff to the gui.BlobLoader
	 * @param {Window} scope
	 * @param {String} source
	 */
	_debug : function ( scope, source ) {
		if ( window.btoa ) {
			source = scope.btoa ( "function debug () {\n" + source + "\n}" );
			var script = scope.document.createElement ( "script" );
			script.src = "data:text/javascript;base64," + source;
			scope.document.querySelector ( "head" ).appendChild ( script );
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
	 * Format script output.
	 * @todo Investigate overhead
	 * @todo Indent switch cases
	 * @todo Remove blank lines
	 * @param {String} body
	 * @returns {String}
	 */
	_format : function ( body ) {
		var result = "",
			tabs = "\t",
			first = null,
			last = null,
			fixt = null,
			flast = null;
		body.split ( "\n" ).forEach ( function ( line ) {
			line = line.trim ();
			first = line.charAt ( 0 );
			last = line.charAt ( line.length - 1 );
			fixt = line.split ( "//" )[ 0 ].trim ();
			flast = fixt.charAt ( fixt.length - 1 );
			if (( first === "}" || first === "]" ) && tabs !== "" ) {				
				tabs = tabs.slice ( 0, -1 );
			}
			result += tabs + line + "\n";
			if ( last === "{" || last === "[" || flast === "{" || flast === "[" ) {
				tabs += "\t";
			}
		});
		return result;
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
	_NESTEXP : /<script.*type=["']?text\/edbml["']?.*>([\s\S]+?)/g,

	/**
	 * @static
	 * Matches a qualified attribute name (class,id,src,href) allowing 
	 * underscores, dashes and dots while not starting with a number.
	 * TODO: https://github.com/jshint/jshint/issues/383
	 * @type {RegExp}
	 */
	_ATTREXP : /^[^\d][a-zA-Z0-9-_\.]+/,

	/**
	 * Match <content/> tag in whatever awkward form.
	 * @type {RegExp}
	 */
	_CONTENT : /<content(.*)>(.*)<\/content>|<content(.*)(\/?)>/

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
	 * 
	 * @param {String} script
	 * @returns {String}
	 */
	_declare : function ( script, head ) {
		this._super._declare ( script, head );
		var defs = [];
		gui.Object.each ( this.inputs, function ( name, type ) {
			head.declarations [ name ] = true;
			defs.push ( name + " = __input__.get ( " + type + " );\n" );
		}, this );
		if ( defs [ 0 ]) {
			head.definitions.push ( 
				"( function lookup ( __input__ ) {\n" +
				defs.join ( "" ) +
				"})( this.script.input ());" 
			);
		}
		return script;
	}

});


/**
 * Tags are functions with boilerplate code.
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
			var content = edb.FunctionCompiler._CONTENT;
			this.params.push ( "content" );
			this.params.push ( "attribs" );
			script = "att = attribs;\n" + script;
			script = script.replace ( content, "content ( out );" );

		}
		return this._super._direct ( script );
	}

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
		} else {
			this._lookup ( url, callback, thisp );
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
	
	// PRIVATES ........................................................
	
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
	 * EDBML templates are loaded as HTML documents with one or more script 
	 * tags. The requested script should have an @id to match the URL #hash.  
	 * If no hash was given, we return the source code of first script found.
	 * @param {String} text HTML with one or more script tags
	 * TODO: cache this stuff for repeated lookups!
	 * @param {gui.URL} url
	 * @returns {String} Template source code
	 */
	_extract : function ( text, url ) {
		var temp = this._document.createElement ( "div" );
		temp.innerHTML = text;
		var script = temp.querySelector ( url.hash || "script" );
		if ( script ) {
			this.directives = gui.AttPlugin.getmap ( script );
			return script.textContent;
		} else {
			console.error ( "No script found: " + url.location );
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
		var args = gui.Type.list ( arguments );
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
 * This fellow compiles a template source string. 
 * The onreadystatechange method fires when ready, 
 * the method "run" may by then invoke the script.
 */
edb.Template = gui.Exemplar.create ( "edb.Template", Object.prototype, {
	
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
		var args = gui.Type.list ( arguments );
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
			if ( this.readyState === edb.Template.READY ) {
				callback.call ( thisp, this );
			}
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
	 * Note to self: While loading the function we 
	 * are mapping variable name to function src...
	 * @type {Map<String,String|function>}
	 */
	functions : null,

	/**
	 * Experiomental...
	 * @type {Map<String,String|function>} ???????
	 */
	tags : null,
	
	/**
	 * Construct.
	 * @param {object} pointer
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( pointer, context, handler ) {
		this._super.onconstruct ( pointer, context, handler );
		/*
		 * Redefine these terms into concepts that makes more 
		 * sense when runinng script inside a worker context. 
		 * (related to a future "sandbox" project of some kind)
		 */
		this.pointer = this.spirit;
		this.context = context;
		this.spirit = null;

		this.tags = Object.create ( null );
		this.functions = Object.create ( null );
	},
	
	/**
	 * Compile source to function.
	 *
	 * 1. Create the compiler (signed for sandbox usage)
	 * 2. Compile source to invokable function 
	 * 3. Preserve source for debugging
	 * 4. Copy expected params
	 * 5. Load required functions and tags.
	 * 6. Report done whan all is loaded.
	 * @overwrites {edb.Template#compile}
	 * @param {String} source
	 * @param {HashMap<String,String>} directives
	 * @returns {edb.Function}
	 */
	compile : function ( source, directives ) {
		if ( this._function === null ) {
			var compiler = this._compiler = new ( this._Compiler ) ( source, directives );
			if ( this._signature ) { 
				compiler.sign ( this._signature );
			}
			this._function = compiler.compile ( this.context );
			this._source = compiler.source;
			this.params = compiler.params;
			gui.Object.each ( compiler.tags, function ( name, src ) {
				this._tagload ( name, src );
			}, this );
			gui.Object.each ( compiler.functions, function ( name, src ) {
				this._functionload ( name, src );
			}, this );
		} else {
			throw new Error ( "TODO: recompile the script :)" );
		}
		return this._oncompiled ();
	},

	/**
	 * Log script source to console.
	 */
	debug : function () {
		console.debug ( this._source );
	},

	/**
	 * Sign generated methods for sandbox scenario.
	 * @param {String} signature
	 * @returns {edb.Function}
	 */
	sign : function ( signature ) {
		this._signature = signature;
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
			case edb.BROADCAST_TAG_LOADED :
				this._tagloaded ( b.data );
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
	 * Optionally stamp a signature into generated edb.Script.invoke() callbacks.
	 * @type {String} 
	 */
	_signature : null,

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
	 * Called when compile is done, as expected.
	 */
	_oncompiled : function () {
		try { // in development mode, load invokable function as a blob file; otherwise skip to init
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
	 * Load function from src.
	 * @param {String} name
	 * @param {String} src
	 */
	_tagload : function ( name, src ) {
		src = gui.URL.absolute ( this.context.document, src );
		var tag = edb.Tag.get ( src, this.context );
		if ( tag ) {
			this.tags [ name ] = tag;
		} else {
			this._await ( edb.BROADCAST_TAG_LOADED, true );
			this.tags [ name ] = src;
		}
	},

	/**
	 * Load function from src.
	 * @param {String} name
	 * @param {String} src
	 */
	_functionload : function ( name, src ){
		src = gui.URL.absolute ( this.context.document, src );
		var func = edb.Function.get ( src, this.context );
		if ( func ) {
			this.functions [ name ] = func;
		} else {
			this._await ( edb.BROADCAST_FUNCTION_LOADED, true );
			this.functions [ name ] = src;
		}
	},

	/**
	 * Funtion loaded from src.
	 * @param {String} src
	 */
	_functionloaded : function ( src ) {
		gui.Object.each ( this.functions, function ( name, value ) {
			if ( value === src ) {
				this.functions [ name ] = edb.Function.get ( src, this.context );
			}
		}, this );
		this._maybeready ();
	},

	/**
	 * Funtion loaded from src.
	 * @param {String} src
	 */
	_tagloaded : function ( src ) {
		gui.Object.each ( this.tags, function ( name, value ) {
			if ( value === src ) {
				this.tags [ name ] = edb.Tag.get ( src, this.context );
			}
		}, this );
		this._maybeready ();
	},

	/**
	 * Watch for incoming functions and tags.
	 * @param {boolean} add
	 */
	_await : function ( msg, add ) {
		var act = add ? "add" : "remove";
		var sig = this.context.gui.signature;
		gui.Broadcast [ act ] ( msg, this, sig );
	},

	/*
	_arrive : function () {
		TODO!
	},
	*/

	/**
	 * Report ready? Otherwise waiting 
	 * for data types to initialize...
	 */
	_maybeready : function () {
		if ( this.readyState !== edb.Template.LOADING ) {
			this._gostate ( edb.Template.WORKING );
			if ( this._done ()) {
				this._await ( edb.BROADCAST_TAG_LOADED, false );
				this._await ( edb.BROADCAST_FUNCTION_LOADED, false );
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
		return [ "functions", "tags" ].every ( function ( map ) {
			return Object.keys ( this [ map ] ).every ( function ( name ) {
				return gui.Type.isFunction ( this [ map ][ name ]);
			}, this );
		}, this );
	},
	
	/**
	 * Add-remove broadcast handlers.
	 * @param {boolean} isBuilding
	 */
	_subscribe : function ( isBuilding ) {
		gui.Broadcast [ isBuilding ? "addGlobal" : "removeGlobal" ] ( gui.BROADCAST_DATA_SUB, this );
		gui.Broadcast [ isBuilding ? "removeGlobal" : "addGlobal" ] ( gui.BROADCAST_DATA_PUB, this );
	}


}, { // Recurring static ................................................

	/**
	 * Get function for SRC.
	 * @todo pass document not window	
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function}
	 */
	get : function ( src, win ) {
		src = new gui.URL ( win.document, src ).href;
		var has = gui.Type.isFunction ( this._map [ src ]);
		if ( !has ) {
			return this._load ( src, win );
		}
		return this._map [ src ];
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
			sig = win.gui.signature;
		new edb.TemplateLoader ( win.document ).load ( src,
			function onload ( source, directives ) {
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
		);
		return func;
	}


}, { // Static ...................................................

	/**
	 * Mount compiled scripts as blob files in development mode?
	 * @todo map to gui.Client.hasBlob somehow...
	 * @type {boolean}
	 */
	useblob : true

});


/**
 * EDB script.
 * @extends {edb.Function}
 */
edb.Script = edb.Function.extend ( "edb.Script", {

	/**
	 * Hijacking the edb.InputPlugin which has been 
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
		this.input.context = this.context;
		this._keys = new Set (); // tracking data model changes

		// @todo this *must* be added before it can be removed ?
		gui.Broadcast.addGlobal ( gui.BROADCAST_DATA_PUB, this );
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} broadcast
	 */
	onbroadcast : function ( b ) {
		this._super.onbroadcast ( b );
		switch ( b.type ) {
			case gui.BROADCAST_DATA_SUB :
				this._keys.add ( b.data );
				break;
			/*
			 * Timeout allows multiple data model 
			 * updates before we rerun the script.
			 */
			case gui.BROADCAST_DATA_PUB :
				if ( this._keys.has ( b.data )) {
					if ( this.readyState !== edb.Template.WAITING ) {
						var tick = edb.TICK_SCRIPT_UPDATE;
						var sig = this.context.gui.signature;
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
	 * TODO: System for this!
	 * @param {edb.Input} input
	 */
	oninput : function ( input ) {
		this._maybeready ();
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
	 * Tracking keys in edb.Model and edb.ArrayModel
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
			gui.Broadcast.dispatchGlobal ( this, gui.BROADCAST_SCRIPT_INVOKE, {
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
	 * @todo Do we need to do this?
	 * @overwrites {edb.Function#_map}
	 * @type {Map<String,function>}
	 */
	_map : Object.create ( null ),

	/**
	 * Message to dispatch when function is loaded. 
	 * The function src appears as broadcast data.
	 * @overwrites {edb.Function#_broadcast}
	 * @type {String}
	 */
	_broadcast : edb.BROADCAST_TAG_LOADED

});


/**
 * Converts JS props to HTML attributes during EDBML rendering phase. 
 * Any methods added to this prototype will become available in EDBML 
 * scripts as: att.mymethod() TODO: How can Att instances be passed?
 * @type {HashMap<String,Object>}
 */
edb.Att = function Att () {};

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
	 * Init module.
	 * @param {Window} context
	 */
	init : function ( context ) {
		context.Object.model = function ( a1, a2 ) {
			return edb.ObjectModel.extend ( a1, a2 );
		};
		context.Array.model = function ( a1, a2 ) {
			return edb.ArrayModel.extend ( a1, a2 );
		};
		context.Map.model = function ( a1, a2 ) {
			return edb.MapModel.extend ( a1, a2 );
		};
		// TODO: detect sandbox...
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