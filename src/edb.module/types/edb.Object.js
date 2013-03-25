/**
 * EDB object type. 
 * @extends {edb.Type}
 */
edb.Object = gui.Class.create ( "edb.Object", Object.prototype, {
	
	/**
	 * Construct edb.Object with optional data.
	 * @param @optional {object|edb.Object} data
	 */
	$onconstruct : function ( data ) {
		Object.defineProperty ( this, "_instanceid", { // iOS weirdness (@TODO is it still there?)
			value: this.$instanceid,
			enumerable : false,
			configurable: false,
			writable: false
		});
		switch ( gui.Type.of ( data )) {
			case "object" : 
			case "undefined" :
				edb.Object.approximate ( this, data || Object.create ( null ));
				break;
			default :
				throw new TypeError ( 
					"Unexpected argument of type " + 
					gui.Type.of ( data )
				);
		}
		this.onconstruct.apply ( this, arguments ); // @TODO do we wan't this?
	}


}, {}, { // Static ......................................................................

	/**
	 * Servers two purposes:
	 * 
	 * 1. Simplistic proxy mechanism to dispatch {gui.Type} broadcasts on object setters and getters. 
	 * 2. Supporting model hierarchy unfolding be newing up all that can be indentified as constructors.
	 * 
	 * @param {edb.Object} handler The edb.Object instance that intercepts properties
	 * @param {object} proxy The object whose properties are being intercepted (the JSON object)
	 */
	approximate : function ( handler, proxy ) {
		var def = null;
		var instance = Object.create ( null ); // mapping properties that redefine from "function" (constructor) to "object" (instance)
		this._definitions ( handler ).forEach ( function ( key ) {
			switch ( gui.Type.of (( def = handler [ key ]))) {

				/*
				 * Method type functions are skipped, constructors get instantiated. 
				 * Similar (named) property in proxy becomes the constructor argument, 
				 * eg. mything : MyThing ({ name: "thing" }) would new up an instance 
				 * of MyThing (with object argument) and assign it to the property.
				 */
				case "function" :
					if ( gui.Type.isConstructor ( def )) {
						var C = def;
						instance [ key ] = new C ( proxy [ key ]);
					}
					break;
				
				/*
				 * Let's try creating an edb.Object by default...
				 * TODO: think more about this
				 */
				case "object" :
					handler [ key ] = new edb.Object ( def );
					break;
					
				/*
				 * Let's try creating an edb.Array by default...
				 * TODO: think more about this
				 */
				case "array" :
					handler [ key ] = new edb.Array ( def );
					break;
					
				/*
				 * Simple properties copied from handler to proxy. 
				 * Strings, numbers, booleans and stuff like that.
				 */
				default :
					if ( !gui.Type.isDefined ( proxy [ key ])) {
						proxy [ key ] = handler [ key ];
					}
					break;
			}
		});
		
		/* 
		 * Setup property accessors for handler.
		 */
		gui.Object.nonmethods ( proxy ).forEach ( function ( key ) {
			gui.Accessors.defineAccessor ( handler, key, {
				getter : edb.Type.getter ( function () {
					return instance [ key ] || proxy [ key ];
				}),
				setter : edb.Type.setter ( function ( value ) {
					var target = instance [ key ] ? instance : proxy;
					target [ key ] = value;
				})
			});
		});
	},

	/**
	 * List non-private fields names from handler that are not 
	 * mixed in from {edb.Type} and not inherited from Object.
	 * @param {edb.Object} handler
	 * @returns {Array<String>}
	 */
	_definitions : function ( handler ) {
		var keys = [];
		gui.Object.all ( handler, function ( key, value ) {
			if ( !gui.Type.isDefined ( Object.prototype [ key ])) {
				if ( !gui.Type.isDefined ( edb.Type.prototype [ key ])) {
					if ( !key.startsWith ( "_" )) {
						keys.push ( key );
					}
				}
			}	
		});
		return keys;
	}
});


/*
 * Mixin methods and properties common 
 * to both {edb.Object} and {edb.Array}
 */
( function mixin () {
	gui.Object.extend ( 
		edb.Object.prototype, 
		edb.Type.prototype 
	);
}());