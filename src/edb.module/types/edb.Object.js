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