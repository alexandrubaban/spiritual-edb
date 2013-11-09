/**
 * edb.Object
 * @extends {edb.Type} at least in principle.
 * @using {gui.Type.isDefined}
 * @using {gui.Type.isComplex}, 
 * @using {gui.Type.isFunction} 
 * @using {gui.Type.isConstructor}
 */
edb.Object = ( function using ( isdefined, iscomplex, isfunction, isconstructor ) {
	
	return gui.Class.create ( Object.prototype, {
		
		/**
		 * Observe object.
		 * @param @optional {IChangeHandler} handler
		 */
		observe : function ( handler ) {
			edb.Object.observe ( this, handler || this );
		},

		/**
		 * Unobserve object.
		 * @param @optional {IChangeHandler} handler
		 */
		unobserve : function ( handler ) {
			edb.Object.unobserve ( this, handler || this );
		},


		// Secret ......................................................................

		/**
		 * Constructor.
		 * @overrides {edb.Type#onconstruct}
		 */
		$onconstruct : function ( data ) {
			edb.Type.prototype.$onconstruct.apply ( this, arguments );
			switch ( gui.Type.of ( data )) {
				case "object" : 
				case "undefined" :
					data = data || {};
					var types = edb.ObjectPopulator.populate ( data, this );
					edb.ObjectProxy.approximate ( data, this, types );
					break;
				default :
					throw new TypeError ( 
						"Unexpected edb.Object constructor argument of type " + 
						gui.Type.of ( data ) + ": " + String ( data )
					);
			}
			this.onconstruct.apply ( this, arguments ); // @TODO do we want this?
			this.oninit ();
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
		 * Object observers.
		 * @type {}
		 */
		_observers : Object.create ( null ),

		/**
		 * Mapping instanceids to maps that map property names to change summaries.
		 * @type {Map<String,Map<String,edb.ObjectChange>>}
		 */
		_changes : Object.create ( null )

	});

}) ( 
	gui.Type.isDefined, 
	gui.Type.isComplex, 
	gui.Type.isFunction, 
	gui.Type.isConstructor
);

/*
 * Mixin methods and properties common to both {edb.Object} and {edb.Array}
 */
( function setup () {
	gui.Tick.add ( edb.TICK_PUBLISH_CHANGES, edb.Object );
	gui.Object.extendmissing ( edb.Object.prototype, edb.Type.prototype );
}());