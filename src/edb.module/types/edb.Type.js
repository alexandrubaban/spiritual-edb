/**
 * Mixin methods and properties common 
 * to both {edb.Object} and {edb.Array}
 * @see {edb.Object}
 * @see {edb.Array}
 */
edb.Type = function () {};
edb.Type.prototype = {
	
	/**
	 * Primary storage key (whatever serverside or localstorage).
	 * @type {String}
	 */
	$primarykey : "id",
		
	/**
	 * Instance key (clientside session only).
	 * TODO: Safari on iPad would exceed call stack when this property was prefixed with "$" 
	 * because all getters would call $sub which would then get $instancekey (ie. overflow).
	 * Why was this only the case only for Safari iPad?
	 * @type {String}
	 */
	_instanceid : null,
	
	/**
	 * Construct.
	 * @TODO instead use $onconstruct consistantly throughout types.
	 */
	onconstruct : function () {},
	
	/**
	 * TODO: what is this?
	 * Init (rename?).
	 */
	$init : function () {},

	/**
	 * Sub.
	 * @TODO don't breoadcast global
	 */
	$sub : function () {
		gui.Broadcast.dispatchGlobal ( null, edb.BROADCAST_GETTER, this._instanceid );
	},
	
	/**
	 * Pub.
	 * @TODO don't breoadcast global
	 */
	$pub : function () {
		gui.Broadcast.dispatchGlobal ( null, edb.BROADCAST_SETTER, this._instanceid );
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
	}
};


// Static ......................................................................

/*
 * Dispatch a getter broadcast before base function.
 */
edb.Type.getter = gui.Combo.before ( function () {
	gui.Broadcast.dispatchGlobal ( this, edb.BROADCAST_GETTER, this._instanceid );
});

/*
 * Dispatch a setter broadcast after base function.
 */
edb.Type.setter = gui.Combo.after ( function () {
	gui.Broadcast.dispatchGlobal ( this, edb.BROADCAST_SETTER, this._instanceid );
});

/**
 * Decorate getters on prototype.
 * @param {object} proto Prototype to decorate
 * @param {Array<String>} methods List of method names
 * @returns {object}
 */
edb.Type.decorateGetters = function ( proto, methods ) {
	methods.forEach ( function ( method ) {
		proto [ method ] = edb.Type.getter ( proto [ method ]);
	});
	return proto;
};

/**
 * Decorate setters on prototype.
 * @param {object} proto Prototype to decorate
 * @param {Array<String>} methods List of method names
 * @returns {object}
 */
edb.Type.decorateSetters = function ( proto, methods ) {
	methods.forEach ( function ( method ) {
		proto [ method ] = edb.Type.setter ( proto [ method ]);
	});
	return proto;
};