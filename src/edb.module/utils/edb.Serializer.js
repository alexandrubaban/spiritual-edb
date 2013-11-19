edb.Serializer = ( function () {

	function Serializer () {}
	Serializer.prototype = {

		/**
		 * Serialize type.
		 * @param {edb.Object|edb.Array} type
		 * @param @optional {function} filter
		 * @param @optional {String|number} tabs
		 * @returns {String}
		 */
		serializeToString : function ( type, filter, tabs ) {
			if ( isType ( type )) {
				return JSON.stringify ( parse ( type ), filter, tabs );
			} else {
				alert ( type );
				throw new TypeError ( "Expected edb.Object|edb.Array" );
			}
		}	
	};

	/**
	 * Thing is a type?
	 * @param {object} thing
	 * @returns {boolean}
	 */
	function isType ( thing ) {
		return edb.Type.is ( thing );
	}

	/**
	 * Thing is edb.Array?
	 * @param {object} thing
	 * @returns {boolean}
	 */
	function isArray ( type ) {
		return edb.Array.is ( type );
	}

	/**
	 * Parse as object node or array node.
	 */
	function parse ( type ) {
		return isArray ( type ) ? asArray ( type ) : asObject ( type );
	}

	/**
	 * Compute object node.
	 * @param {edb.Object|edb.Array} type
	 * @returns {object}
	 */
	function asObject ( type ) {
		var map = gui.Object.map ( type, mapObject, type );
		return {
			$object : gui.Object.extend ( map, {
				$classname : type.$classname,
				$instanceid : type.$instanceid
			})
		};
	}

	/**
	 * Compute array node.
	 * @param {edb.Object|edb.Array} type
	 * @returns {object}
	 */
	function asArray ( type ) {
		return gui.Object.extend ( asObject ( type ), {
			$array : mapArray ( type )
		});
	}

	/**
	 * Map the object properties of a type. 
	 * Skip all array intrinsic properties.
	 * @param {String} key
	 * @param {object} value
	 */
	function mapObject ( key, value ) {
		if ( isArray ( this ) && key.match ( /^length|^\d+/ )) {
			return undefined;
		} else {
			return isType ( value ) ? parse ( value ) : value;
		}
	}

	/**
	 * Map array members.
	 * @param {edb.Array} type
	 */
	function mapArray ( type ) {
		return Array.map ( type, function ( thing ) {
			return isType ( thing ) ? parse ( thing ) : thing;
		});
	}

	return Serializer;

}());