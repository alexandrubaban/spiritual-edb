/**
 * Populates instance properties. Supports model unfolding 
 * by newing up all that can be indentified as constructors.
 * @using {gui.Type.isDefined}
 * @using {gui.Type.isComplex}, 
 * @using {gui.Type.isFunction} 
 * @using {gui.Type.isConstructor}
 */
edb.ObjectPopulator = ( function using ( isdefined, iscomplex, isfunction, isconstructor ) {

	/**
	 * List non-private fields names from handler that are not 
	 * mixed in from {edb.Type} and not inherited from native.
	 * @param {edb.Object} handler
	 * @returns {Array<String>}
	 */
	function definitions ( handler ) {
		var Type = edb.Object.is ( handler ) ? edb.Object : edb.Array;
		var Base = edb.Object.is ( handler ) ? Object : Array;
		var keys = [], classes = [ edb.Type, Type, Base ];
		gui.Object.all ( handler, function ( key ) {
			if ( isregular ( key ) && classes.every ( function ( o ) {
				return o.prototype [ key ] === undefined;
			})) {
				keys.push ( key );
			}
		});
		return keys;
	}

	/**
	 * @TODO: higher level this feature in {gui.Property}
	 */
	function hiddenprop ( type, name, value ) {
		Object.defineProperty ( type, name, gui.Property.nonenumerable ({
			value : value
		}));
	}

	/**
	 * @TODO: Call this something else...
	 * @param {object} json
	 * @param {edb.Object|edb.Array} type
	 */
	function evalheaders ( json, type ) {
		var id = json.$instanceid;
		if ( id ) {
			hiddenprop ( type, "$originalid", id );
			delete json.$instanceid;
		}
	}

	/**
	 * Fail me once.
	 * @param {String} name
	 * @param {String} key
	 */
	function faildefined ( name, key ) {
		throw new TypeError ( name + " declares \"" + key + "\" as something undefined" );
	}

	/**
	 * Fail me twice.
	 * @param {String} name
	 * @param {String} key
	 */
	function failconstructor ( name, key ) {
		throw new TypeError ( name + " \"" + key + "\" must resolve to a constructor" );
	}

	/**
	 * Object key is not a number and doesn't start with exoctic character? 
	 * @param {String|number} key
	 * @returns {boolean}
	 */
	function isregular ( key ) {
		return key.match ( /^[a-z]/i );
	}


	return { // Public ...............................................................

		/**
		 * Populate object properties of type instance.
		 * @param {object} json
		 * @param {edb.Object|edb.Array} type
		 * @return {Map<String,edb.Object|edb.Array>} types
		 */
		populate : function ( json, type ) {
			var Def, def, val, desc, types = Object.create ( null );
			var base = type.constructor.prototype;
			var name = type.constructor.$classname;
			evalheaders ( json, type );
			definitions ( type ).forEach ( function ( key ) {
				def = type [ key ];
				val = json [ key ];
				if ( isdefined ( val )) {
					if ( isdefined ( def )) {
						if ( iscomplex ( def )) {
							if ( isfunction ( def )) {
								if ( !isconstructor ( def )) {
									def = def ( val );
								}
								if ( isconstructor ( def )) {
									Def = def;
									types [ key ] = new Def ( json [ key ]);
								} else {
									failconstructor ( name, key );
								}
							} else {
								types [ key ] = edb.Type.cast ( isdefined ( val ) ? val : def );
							}
						}
					} else {
						faildefined ( name, key );
					}
				} else {
					if ( isregular ( key ) && edb.Type.isConstructor ( def )) {
						/*
						 * @TODO: cleanup something here
						 */
						if ( edb.Array.isConstructor ( def )) {
							json [ key ] = [];	
						} else {
							json [ key ] = null; // @TODO: stay null somehow...
						}
						Def = def;
						types [ key ] = new Def ( json [ key ]);
					} else {
						if (( desc = Object.getOwnPropertyDescriptor ( base, key ))) {
							Object.defineProperty ( json, key, desc );
						}
					}
				}
			});
			gui.Object.nonmethods ( json ).forEach ( function ( key ) {
				var def = json [ key ];
				if ( isregular ( key ) && gui.Type.isComplex ( def )) {
					if ( !types [ key ]) {
						types [ key ] = edb.Type.cast ( def );
					}
				}
			});
			return types;
		}

	};

}) ( 
	gui.Type.isDefined, 
	gui.Type.isComplex, 
	gui.Type.isFunction, 
	gui.Type.isConstructor
);