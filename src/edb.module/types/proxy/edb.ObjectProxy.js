edb.ObjectProxy = ( function () {

	/**
	 * Create getter for key.
	 * @param {String} key
	 * @param {function} base
	 * @returns {function}
	 */
	function getter ( key, base ) {
		return function () {
			var result = base.apply ( this );
			edb.Object.$onaccess ( this, key );
			return result;
		};
	}

	/**
	 * Create setter for key.
	 * @param {String} key
	 * @param {function} base
	 * @returns {function}
	 */
	function setter ( key, base ) {
		return function ( newval ) {
			var oldval = this [ key ]; // @TODO suspend something?
			base.apply ( this, arguments );
			if ( newval !== oldval ) {
				edb.Object.$onchange ( this, key, oldval, newval );
				oldval = newval;
			}
		};
	}

	return { // Public ............................................................................

		/**
		 * Simplistic proxy mechanism to dispatch broadcasts on getters and setters.
		 * @param {object} target The object whose properties are being intercepted (the JSON object)
		 * @param {edb.Object} handler The edb.Object instance that intercepts all the properties
		 */
		approximate : function ( target, handler, types ) {

			/* 
			 * 1. Objects by default convert to edb.Object
			 * 2. Arrays by default convert to edb.Array
			 * 3. Simple properties get target accessors
			 *
			 * @TODO: Setup now proxies array indexes, 
			 * unsupport this or re-approximate on changes
			 *
			 * @TODO: when resetting array, make sure that 
			 * it becomes xx.MyArray (not plain edb.Array)
			 */
			gui.Object.nonmethods ( target ).forEach ( function ( key ) {
				var desc = Object.getOwnPropertyDescriptor ( target, key );
				if ( desc.hasOwnProperty ( "value" )) {
					Object.defineProperty ( handler, key, {
						enumerable : desc.enumerable,
						configurable : desc.configurable,
						get : getter ( key, function () {
							return types [ key ] || target [ key ];
						}),
						set : setter ( key, function ( value ) {
							var x = types [ key ] ? types : target;
							x [ key ] = edb.Type.cast ( value );
						})
					});
				} else {
					throw new TypeError ( "Accessor not supported: " + key );
				}
			});

			/**
			 * Experimental...
			 */
			gui.Object.ownmethods ( target ).forEach ( function ( key ) {
				handler [ key ] = target [ key ];
			});
		}
	};

}());


// TODO .......................................................................

/*
var handler = {
	get: function ( target, name ) {
		return name in target ? target [ name ] : 37;
	},
	set : function ( target, name, value ) {
		target [ name ] = value;
		console.log ( "Hej" );
	}
};
*/
/*
var Test = gui.Class.create ( Object.prototype, {

	get : function ( target, name ) {
		return name in target ? target [ name ] : this [ name ];
	},

	set : function ( target, name, value ) {
		target [ name ] = value;
	},

	alarm : function () {
		console.log ( "Spasser" );
	},

	$onconstruct : function ( json ) {
		return new Proxy ( json, this );
	}
});

var test = new Test ({
	heil : 23,
	fiss : "fiss"
});
test.heil = 48;
console.log ( test.fiss );
test.alarm ();

edb.Handler = {
	get: function ( target, name ) {
		return name in target ? target [ name ] : 37;
	},
	set : function ( target, name, value ) {
		target [ name ] = value;
		console.log ( "Hej" );
	}
};

edb.Proxy = function ( target, handler ) {


};
*/