/**
 * Spirit input.
 * @param {object} data
 * @param {function} type
 */
edb.Input = function SpiritInput ( type, data ) {
	
	this.type = type || null;
	this.data = data || null;
};

edb.Input.prototype = {
	
	/**
	 * Input type (is a function constructor)
	 * @type {function}
	 */
	type : null,
	
	/**
	 * Input data (is an instance of this.type)
	 * @type {object} data
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
 * @static
 * TODO: out of global
 * Subscribe handler to input.
 * @param {object} handler Implements InputListener
 */
edb.Input.add = function ( handler ) {
	
	gui.Broadcast.addGlobal ( gui.BROADCAST_OUTPUT, handler );
};

/**
 * @static
 * TODO: out of global
 * Unsubscribe handler from input.
 * @param {object} handler Implements InputListener
 */
edb.Input.remove = function ( handler ) {
	
	gui.Broadcast.removeGlobal ( gui.BROADCAST_OUTPUT, handler );
};