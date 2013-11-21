edb.Parser = ( function () {

	function Parser () {}
	Parser.prototype = {

		/**
		 * @returns {edb.Object|edb.Array}
		 */
		parseFromString : function ( json, type ) {
			json = JSON.parse ( json );
			if ( isType ( json )) {
				return parse ( json, type );
			} else {
				throw new TypeError ( "Expected serialized edb.Object|edb.Array" );
			}
		}
	};

	/**
	 * @returns {edb.Object|edb.Array}
	 */
	function parse ( json, type ) {
		var Type, name;
		if ( type === null ) {}
		else if ( type ) {			
			name = type.$classname || name;
			Type = name ? type : gui.Object.lookup ( name );
		} else {
			name = json.$object.$classname;
			Type = gui.Object.lookup ( name );
		}
		json = mapValue ( json );
		if ( type === null ) {
			return json;
		} else if ( Type ) {
			return Type.from ( json );
		} else {
			throw new TypeError ( name + " is not defined" );	
		}
	}

	/**
	 * Is typed node?
	 * @param {object} json
	 * @returns {boolean}
	 */
	function isType ( json ) {
		return gui.Type.isComplex ( json ) && ( json.$array || json.$object );
	}

	/**
	 * Parse node as typed instance.
	 * @param {object} type
	 * @return {object}
	 */
	function asObject ( type ) {
		return gui.Object.map ( type.$object, mapObject );
	}

	/**
	 * Parse array node to array members (transform from object to array). 
	 * 
	 * @returns {}
	 */
	function asArray ( type ) {
		var members = type.$array.map ( mapValue );
		members.$object = type.$object;
		return members;
	}

	/**
	 * @returns {}
	 */
	function mapObject ( key, value ) {
		return mapValue ( value );
	}

	/**
	 * @returns {}
	 */
	function mapValue ( value ) {
		if ( isType ( value )) {
			return value.$array ? asArray ( value ) : asObject ( value );
		}
		return value;
	}

	return Parser;

}());