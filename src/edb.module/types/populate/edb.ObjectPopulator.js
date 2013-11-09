/**
 * Populates types on construction. Supports model unfolding 
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
		var Type = handler instanceof edb.Object ? edb.Object : edb.Array;
		var Base = handler instanceof edb.Object ? Object : Array;
		var keys = [], classes = [ edb.Type, Type, Base ];
		gui.Object.all ( handler, function ( key ) {
			if ( !key.startsWith ( "_" ) && classes.every ( function ( o ) {
				return o.prototype [ key ] === undefined;
			})) {
				keys.push ( key );
			}	
		});
		return keys;
	}


	return { // Public ...............................................................

		populate : function ( json, type ) {

			var name = type.constructor.$classname;
			var Def, def, val, types = {};
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
									throw new TypeError ( name + " \"" + key + "\" must resolve to a constructor" );
								}
							} else {
								types [ key ] = edb.Type.cast ( isdefined ( val ) ? val : def );
							}
						} else {
							// json [ key ] = def; ???
						}
					} else {
						throw new TypeError ( name + " declares \"" + key + "\" as something undefined" );
					}
				} else {
					json [ key ] = def;
				}
			});

			/*
			 * 
			 */
			gui.Object.nonmethods ( json ).forEach ( function ( key ) {
				var def = json [ key ];
				if ( gui.Type.isComplex ( def )) {
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