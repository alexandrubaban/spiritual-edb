/**
 * Adopt the format of {gui.Broadcast} to facilitate easy switch cases 
 * on the Type constructor instead of complicated 'instanceof' checks. 
 * The Type instance object may be picked out of the 'data' property.
 * @param {edb.Object|edb.Array} type
 */
edb.Input = function Input ( type ) {
	if ( edb.Type.is ( type )) {
		this.type = type.constructor;
		this.data = type;
	} else {
		throw new TypeError ( type + " is not a Type" );
	}
};

edb.Input.prototype = {
	
	/**
	 * Input Type (function constructor)
	 * @type {function}
	 */
	type : null,
	
	/**
	 * Input instance (instance of this.Type)
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