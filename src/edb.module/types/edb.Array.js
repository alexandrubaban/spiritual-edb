/**
 * @using {Array.prototype}
 * @using {gui.Combo chained}
 */
( function using ( proto, chained ) {

	/**
	 * edb.Array
	 * @extends {edb.Type} (although not really)
	 */
	edb.Array = gui.Class.create ( proto, {

		/**
		 * Push.
		 */
		push : function () {
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


		// Expandos ...........................................................................

		/**
		 * Just to illustrate that arrays may conveniently get their 
		 * content assigned to a variable name via the arguments list.
		 * @param {Array<object>} members (edb.Types all newed up here)
		 */
		onconstruct : function ( members ) {},

		/**
		 * Observe array (both object properties and list mutations). 
		 * @param @optional {IChangeHandler} handler
		 * @returns {edb.Array}
		 */
		addObserver : chained ( function ( handler ) {
			edb.Object.observe ( this, handler );
			edb.Array.observe ( this, handler );
		}),

		/**
		 * Unobserve array.
		 * @param @optional {IChangeHandler} handler
		 * @returns {edb.Array}
		 */
		removeObserver : chained ( function ( handler ) {
			edb.Object.unobserve ( this, handler );
			edb.Array.unobserve ( this, handler );
		}),

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
			var oprops = {}, types;
			edb.Type.prototype.$onconstruct.apply ( this, arguments );
			edb.ArrayPopulator.populate ( this, arguments );
			types = edb.ObjectPopulator.populate ( oprops, this );
			edb.ObjectProxy.approximate ( oprops, this, types );
			this.onconstruct ([].slice.call ( this ));
		},

		/**
		 * Create true array without expando properties, recursively normalizing nested EDB 
		 * types. Returns the type of array we would typically transmit back to the server. 
		 * @returns {Array}
		 */
		$normalize : function () {
			return Array.map ( this, function ( thing ) {
				if ( edb.Type.is ( thing )) {
					return thing.$normalize ();
				}
				return thing;
			});
		}
	});

	
	// Helpers ..........................................................

	/**
	 * Convert arguments.
	 * @param {edb.Array} array
	 * @param {Arguments} args
	 * @returns {Array}
	 */
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
	
}( Array.prototype, gui.Combo.chained ));


/**
 * Mixin static methods. Recurring static members mixed in from {edb.Type}.
 */
edb.Array.mixin ( null, edb.Type.$staticmixins (), {

	/**
	 * Observe.
	 */
	observe : edb.Type.$observe,

	/**
	 * Unobserve.
	 */
	unobserve : edb.Type.$unobserve,

	/**
	 * Something is a subclass constructor of {edb.Array}?
	 * @TODO let's generalize this facility in {gui.Class}
	 */
	isConstructor : function ( o ) {
		return gui.Type.isConstructor ( o ) && 
			gui.Class.ancestorsAndSelf ( o ).indexOf ( edb.Array ) >-1;
	},
	
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


	// Private static .........................................................

	/**
	 * Mapping instanceids to lists of observers.
	 * @type {Map<String,Array<edb.IChangeHandler>>}
	 */
	_observers : Object.create ( null ),

	/**
	 * Mapping instanceids to lists of changes.
	 * @type {Map<String,Array<edb.ArrayChange>>}
	 */
	_changes : Object.create ( null ),

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