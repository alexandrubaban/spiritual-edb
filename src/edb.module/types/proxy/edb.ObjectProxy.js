edb.ObjectProxy = ( function () {

	/**
	 * Create observable getter for key.
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
	 * Create observable setter for key.
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
				if ( desc.configurable ) {
					Object.defineProperty ( handler, key, {
						enumerable : desc.enumerable,
						configurable : desc.configurable,
						get : getter ( key, function () {
							if ( desc.get ) {
								return desc.get.call ( this );
							} else {
								return types [ key ] || target [ key ];
							}
						}),
						set : setter ( key, function ( value ) {
							var Type, type;
							if ( desc.set ) {
								desc.set.call ( this, value );
							} else {
								if (( type = types [ key ])) {
									Type = type.constructor; // @TODO: filter function support!
									types [ key ] = new Type ( value );
								} else {
									target [ key ] = edb.Type.cast ( value );
								}
							
							}
						})
					});
				}
			});
			gui.Object.ownmethods ( target ).forEach ( function ( key ) {
				handler [ key ] = target [ key ];
			});
		}
	};

}());