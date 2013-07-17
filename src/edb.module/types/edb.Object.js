/**
 * edb.Object
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
	 * TODO
	 * @param {edb.Object} object
	 * @param {edb.IChangeHandler} handler
	 * @returns {edb.Object}
	 */
	observe : function ( object, handler ) {
		var id = object.$instanceid;
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
		var id = object.$instanceid;
		var obs = this._observers;
		var index, handlers = obs [ id ];
		if ( handlers ) {
			index = handlers.indexOf ( handler );
			if ( index >-1 && gui.Array.remove ( handlers, index ) === 0 ) {
				delete obs [ id ];
			}
		}
		return object;
	},

	/**
	 * Publishing change summaries async.
	 * @TODO: move to edb.Type (edb.Type.observe)
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {
		var changes, handlers, observers = this._observers;
		if ( tick.type === edb.TICK_PUBLISH_CHANGES ) {
			changes = gui.Object.copy ( this._changes );
			this._changes = Object.create ( null );
			gui.Object.each ( changes, function ( instanceid, changes ) {
				if (( handlers = observers [ instanceid ])) {
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
		var Def, def, instances = Object.create ( null );
		this._definitions ( handler ).forEach ( function ( key ) {
			def = handler [ key ];
			if ( gui.Type.isComplex ( def )) {
				if ( gui.Type.isConstructor ( def )) {
					Def = def;
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
					handler [ key ] = instances [ key ] || new edb.Object ( def );
					break;
				case "array" :
					handler [ key ] = instances [ key ] || new edb.Array ( def );
					break;
				default :
					gui.Property.accessor ( handler, key, {
						getter : edb.Object._getter ( key, function () {
							return instances [ key ] || proxy [ key ];
						}),
						setter : edb.Object._setter ( key, function ( value ) {
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
( function setup () {
	gui.Tick.add ( edb.TICK_PUBLISH_CHANGES, edb.Object );
	gui.Object.extend ( 
		edb.Object.prototype, 
		edb.Type.prototype 
	);
}());
