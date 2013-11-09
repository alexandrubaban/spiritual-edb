/**
 * @using {gui.Type.isConstructor}
 */
edb.ArrayPopulator = ( function using ( isconstructor ) {

	/**
	 * Convert via constructor or via filter 
	 * function which returns a constructor.
	 * @param {Array} args
	 * @param {function} func
	 * @returns {Array<edb.Type>}
	 */
	function declareconvert ( args, func ) {
		var Type = func, is = isconstructor ( Type );
		return args.map ( function ( o ) {
			if ( o !== undefined && !o._instanceid ) {
				Type = is ? Type : func ( o );
				if ( Type.$classid ) {
					o = new Type ( o );
				} else {
					throw new TypeError ();
				}
			}
			return o;
		});
	}

	/**
	 * Objects and arrays automatically converts 
	 * to instances of {edb.Object} and {edb.Array} 
	 * @param {Array} args
	 * @returns {Array}
	 */
	function defaultconvert ( args ) {
		return args.map ( function ( o ) {
			if ( !edb.Type.isInstance ( o )) {
				switch ( gui.Type.of ( o )) {
					case "object" : 
						return new edb.Object ( o );
					case "array" :
						return new edb.Array ( o );
				}
			}
			return o;
		});
	}

	return { // Public .........................................................

		/**
		 * Populate {edb.Array} from constructor arguments.
		 *
		 * 1. Populate as normal array, one member for each argument
		 * 2. If the first argument is an array, populate 
		 *    using this and ignore the remaining arguments.
		 *    
		 * @TODO read something about http://www.2ality.com/2011/08/spreading.html
		 * @param {edb.Array}
		 * @param {Arguments} args
		 */
		populate : function ( array, args ) {
			var members;
			if ( args.length ) {
				members = [];
				if ( gui.Type.isArray ( args [ 0 ])) {
					members = args [ 0 ];
				} else {
					if ( args [ 0 ] instanceof edb.Array ) {
						args = args [ 0 ];
					}
					members = Array.prototype.slice.call ( args );
				}
				members = this.convert ( array, members );
				Array.prototype.push.apply ( array, members );
			}
		},

		/**
		 * Convert arguments.
		 * @param {edb.Array} array
		 * @param {Arguments|array} args
		 * @returns {Array}
		 */
		convert : function ( array, args ) {
			args = gui.Object.toArray ( args );
			if ( gui.Type.isFunction ( array.$of )) {
				return declareconvert ( args, array.$of );
			} else {
				return defaultconvert ( args );
			}
		}

	};

}( gui.Type.isConstructor ));