/**
 * @using {gui.Type.isConstructor}
 */
edb.ArrayPopulator = ( function () {

	/**
	 * Array was declared to contain lists (not objects)?
	 * @param {edb.Array} array
	 * @returns {boolean}
	 */
	function oflist ( array ) {
		return array.$of && array.$of.prototype.reverse;
	}

	/**
	 * Something is a list?
	 * @param {object} o
	 * @returns {boolean}
	 */
	function islist ( o ) {
		return Array.isArray ( o ) || edb.Array.is ( o );
	}

	/**
	 * Convert via constructor or via filter 
	 * function which returns a constructor.
	 * @param {Array} args
	 * @param {function} func
	 * @returns {Array<edb.Type>}
	 */
	function guidedconvert ( args, func ) {
		var Type = func, is = gui.Type.isConstructor ( Type );
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
	function autoconvert ( args ) {
		return args.map ( function ( o ) {
			if ( !edb.Type.is ( o )) {
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
		 * Populate {edb.Array} from constructor arguments. This works like normal 
		 * arrays, except for the scenario where 1) the content model of the array 
		 * is NOT arrays (ie. not a dimensional array) and 2) the first argument IS 
		 * an array OR an {edb.Array} in which case the first members of this list 
		 * will populate into the array and the remaining arguments will be ignored. 
		 * @TODO read something about http://www.2ality.com/2011/08/spreading.html
		 * @param {edb.Array}
		 * @param {Arguments} args
		 */
		populate : function ( array, args ) {
			var first = args [ 0 ];
			if ( first ) {
				if ( !oflist ( array ) && islist ( first )) {
					args = first;
				}
				Array.prototype.push.apply ( array, 
					this.convert ( array, args )
				);
			}
		},

		/**
		 * Convert arguments.
		 * @param {edb.Array} array
		 * @param {Arguments|array} args
		 * @returns {Array}
		 */
		convert : function ( array, args ) {
			args = gui.Array.from ( args );
			if ( gui.Type.isFunction ( array.$of )) {
				return guidedconvert ( args, array.$of );
			} else {
				return autoconvert ( args );
			}
		}

	};

}());