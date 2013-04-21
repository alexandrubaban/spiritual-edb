/**
 * Mixin methods and properties common 
 * to both {edb.Object} and {edb.Array}
 * @see {edb.Object}
 * @see {edb.Array}
 */
edb.Type = function () {};
edb.Type.prototype = {
	
	/**
	 * Primary storage key (serverside or localstorage).
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
	 * Called after $onconstruct (by gui.Class convention).
	 * @TODO instead use $onconstruct consistantly throughout types?
	 */
	onconstruct : function () {},
	
	/**
	 * Serialize to JSON string without private and expando properties.
	 * @todo Declare $normalize as a method stub here (and stull work in subclass)
	 * @param {function} filter
	 * @param {String|number} tabber
	 * @returns {String}
	 */
	$stringify : function ( filter, tabber ) {
		return JSON.stringify ( this.$normalize (), filter, tabber );
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
 * Decorate getter methods on prototype.
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
 * Decorate setter methods on prototype.
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

/**
 * Redefine the $instanceid to start with an underscore 
 * because of some iOS weirdness (does it still apply?)
 * @param {edb.Type} instance
 */
edb.Type.underscoreinstanceid = function ( instance ) {
	Object.defineProperty ( instance, "_instanceid", {
		value: instance.$instanceid
	});
};

/**
 * Is type instance?
 * @param {object} o
 * @returns {boolean}
 */
edb.Type.isInstance = function ( o ) {
	if ( gui.Type.isComplex ( o )) {
		return o instanceof edb.Object || o instanceof edb.Array;
	}
	return false;
};