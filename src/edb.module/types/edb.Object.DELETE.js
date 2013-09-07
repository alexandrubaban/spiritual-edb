/**
 * edb.Object
 * @extends {edb.Type}
 * @using {gui.Type.isDefined}
 * @using {gui.Type.isComplex}, 
 * @using {gui.Type.isFunction} 
 * @using {gui.Type.isConstructor}
 */
( function using ( isdefined, iscomplex, isfunction, isconstructor ) {
	
	edb.Object = gui.Class.create ( Object.prototype, {
		
		/**
		 * Constructor.
		 * @overrides {edb.Type#onconstruct}
		 */
		$onconstruct : function ( data ) {
			edb.Type.prototype.$onconstruct.apply ( this, arguments );
			switch ( gui.Type.of ( data )) {
				case "object" : 
				case "undefined" :
					edb.Object._approximate ( this, data || Object.create ( null ));
					break;
				default :
					throw new TypeError ( 
						"Unexpected edb.Object constructor argument of type " + 
						gui.Type.of ( data ) + ": " + String ( data )
					);
			}
			this.onconstruct.apply ( this, arguments ); // @TODO do we want this?
			this.$oninit ();
		},
		
		/**
		 * Create clone of this object filtering out 
		 * underscore and dollar prefixed properties. 
		 * Recursively normalizing nested EDB types.
		 * TODO: WHITELIST stuff that *was* in JSON!
		 * @returns {object}
		 */
		$normalize : function () {
			var c, o = {};
			gui.Object.each ( this, function ( key, value ) {
				c = key [ 0 ];
				if ( c !== "$" && c !== "_" ) {
					if ( edb.Type.isInstance ( value  )) {
						value = value.$normalize ();	
					}
					o [ key ] = value;	
				}
			});
			return o;
		}


	}, ( function mixins () { // Recurring static ..........................................

		/*
		 * edb.Object and edb.Array don't really subclass edb.Type, 
		 * so we'll just have to hack in these shared static fields. 
		 * @TODO: formalized mixin strategy for recurring statics...
		 */
		return edb.Type.$staticmixins ();
		

	}()), { // Static ......................................................................

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
			var name = handler.constructor.$classname;
			var Def, def, val, types = Object.create ( null );
			this._definitions ( handler ).forEach ( function ( key ) {
				def = handler [ key ];
				val = proxy [ key ];
				if ( isdefined ( val )) {
					if ( isdefined ( def )) {
						if ( iscomplex ( def )) {
							alert ( key + ": "+ JSON.stringify ( def ));
							if ( isfunction ( def )) {
								if ( !isconstructor ( def )) {
									def = def ( val );
								}
								if ( isconstructor ( def )) {
									Def = def;
									types [ key ] = new Def ( proxy [ key ]);
								} else {
									throw new TypeError ( name + " \"" + key + "\" must resolve to a constructor" );
								}
							} else {
								types [ key ] = edb.Type.cast ( isdefined ( val ) ? val : def );
							}
						} else {
							proxy [ key ] = def;
						}
					} else {
						throw new TypeError ( name + " declares \"" + key + "\" as something undefined" );
					}
				} else {
					proxy [ key ] = def;
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
				if ( gui.Type.isComplex ( def )) {
					if ( !types [ key ]) {
						types [ key ] = edb.Type.cast ( def );
					}
				} else {
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

}) ( 
	gui.Type.isDefined, 
	gui.Type.isComplex, 
	gui.Type.isFunction, 
	gui.Type.isConstructor
);