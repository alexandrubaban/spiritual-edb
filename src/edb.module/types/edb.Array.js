/**
 * @using {Array.prototype}
 * @using {gui.Type.isConstructor}
 */
( function using ( proto, isconstructor ) {

	/**
	 * edb.Array
	 * @extends {edb.Type} (although not really)
	 */
	edb.Array = gui.Class.create ( proto, {

		/**
		 * Push.
		 */
		push : function() {
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
				var out = this.$normalize ();
				var add = proto.reverse.apply ( out.slice ());
				onchange ( this, 0, out, add );	
			}
			return proto.reverse.apply ( this );
		},


		// Custom ..............................................................................

		/**
		 * Observe array.
		 * @param @optional {IChangeHandler} handler
		 */
		addObserver : function ( handler ) {
			edb.Object.observe ( this, handler );
			edb.Array.observe ( this, handler );
		},

		/**
		 * Unobserve array.
		 * @param @optional {IChangeHandler} handler
		 */
		removeObserver : function ( handler ) {
			edb.Object.unobserve ( this, handler );
			edb.Array.observe ( this, handler );
		},

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
			edb.Type.prototype.$onconstruct.apply ( this, arguments );
			edb.ArrayPopulator.populate ( this, arguments );
			var data = data || {};
			var types = edb.ObjectPopulator.populate ( data, this );
			edb.ObjectProxy.approximate ( data, this, types );
			this.onconstruct ([].slice.call ( this ));
			this.oninit (); // @deprecated
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


		// Static secret .....................................................................

		

		/**
		 * Simplistic proxy mechanism. 
		 * @param {object} handler The object that intercepts properties (the edb.Array)
		 * @param {object} proxy The object whose properties are being intercepted (raw JSON data)
		 *
		$approximate : function ( handler, proxy ) {
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
			 *
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
		*/
		


		// Private static .........................................................

		/**
		 * Array observers.
		 * @type {}
		 */
		_observers : Object.create ( null ),

		/**
		 * Mapping instanceids to lists of changes.
		 * @type {Map<String,Array<edb.ArrayChange>>}
		 */
		_changes : Object.create ( null ),

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

	
	// Helpers ..........................................................

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

}( 
	Array.prototype, 
	gui.Type.isConstructor )
);

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