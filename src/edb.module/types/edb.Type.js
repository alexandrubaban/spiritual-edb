/**
 * @see {edb.Object}
 * @see {edb.Array}
 */
edb.Type = function Type () {}; // EDB model base class. 
edb.Type.prototype = {
	
	/**
	 * Primary storage key (whatever serverside or localstorage).
	 * @type {String}
	 */
	$primaryKey : "id",
		
	/**
	 * Instance key (clientside session only).
	 * TODO: Safari on iPad would exceed call stack when this property was prefixed with "$" 
	 * because all getters would call $sub which would then get $instancekey (ie. overflow).
	 * Why was this only the case only for Safari iPad?
	 * @type {String}
	 */
	_instanceKey : null,
	
	/**
	 * Construct.
	 */
	onconstruct : function () {},
	
	/**
	 * TODO: what is this?
	 * Init (rename?).
	 */
	$init : function () {},

	/**
	 * Sub.
	 */
	$sub : function () {
		gui.Broadcast.dispatchGlobal ( null, gui.BROADCAST_DATA_SUB, this._instanceKey );
	},
	
	/**
	 * Pub.
	 */
	$pub : function () {
		gui.Broadcast.dispatchGlobal ( null, gui.BROADCAST_DATA_PUB, this._instanceKey );
	},
	
	/**
	 * Serialize to string.
	 * @param {boolean} pretty
	 */
	$serialize : function ( pretty ) {
		
		/*
		 * Avoid reading properties during this operation 
		 * because this may trigger endless $sub() invoke.
		 */
		var clone = JSON.parse ( JSON.stringify ( this ));
		Object.keys ( clone ).forEach ( function ( key ) {
			switch ( key.charAt ( 0 )) {
				case "$" :
				case "_" :
					delete clone [ key ];
					break;
			}
		});
		return JSON.stringify ( 
			clone, null, pretty ? "\t" : "" 
		);
	},
	
	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "edb.Type#toString :)";
	}
};