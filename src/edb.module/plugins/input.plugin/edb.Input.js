/**
 * EDB input.
 * @param {object} data
 * @param {function} type
 */
edb.Input = function Input ( type, data ) {
	this.type = type || null;
	this.data = data || null;
};

edb.Input.prototype = {
	
	/**
	 * Input type (function constructor)
	 * @type {function}
	 */
	type : null,
	
	/**
	 * Input data (instance of this.type)
	 * @type {object|edb.Type} data
	 */
	data : null,
	
	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Input]";
	}
};

/**
 * Format data as an {edb.Type} and wrap it in an {edb.Input}.
 * TODO: Support non-automated casting to edb.Object and edb.Array (raw JSON)?
 * @param {Window|WebWorkerGlobalScope} context
 * @param {object|Array|edb.Input} data
 * @param @optional {function|String} Type
 * @returns {edb.Input}
 */
edb.Input.format = function ( context, data, Type ) {
	if ( data instanceof edb.Input === false ) {
		if ( Type ) {
			Type = edb.Type.lookup ( context, Type );
			if ( data instanceof Type === false ) {
				data = new Type ( data );
			}
		} else if ( !data._instanceid ) { // TODO: THE WEAKNESS
			switch ( gui.Type.of ( data )) {
				case "object" :
					Type = edb.Object.extend ();
					break;
				case "array" :
					Type = edb.Array.extend ();
					break;
			}
			data = this.format ( data, Type );
		} else {
			Type = data.constructor;
		}
		data = new edb.Input ( Type, data ); // data.constructor?
	}
	return data;
};