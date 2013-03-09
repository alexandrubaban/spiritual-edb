/**
 * DataObject.
 */
edb.ObjectModel = gui.Class.create ( "edb.ObjectModel", edb.Model.prototype, {
	
	/**
	 * Hello.
	 */
	__construct__ : function ( data ) {
		this._instanceKey = gui.KeyMaster.generateKey ();
		var type = gui.Type.of ( data );
		switch ( type ) {
			case "object" :
			case "undefined" :
				edb.ObjectModel.approximate ( this, data );
				this.onconstruct ();
				break;
			default :
				throw new TypeError ( 
					"Unexpected argument of type " + 
					type.toUpperCase () + ":\n" + data 
				);
		}
	}


}, { // recurring static fields .........................................
	
	__name__ : "DataObject",
	__data__ : true
	
	
}, { // static fields ............................................

	/**
	 * Simplistic proxy mechanism: call $sub() on get property and $pub() on set property.
	 * @param {object} handler The object that intercepts properties (the edb.ObjectModel)
	 * @param {object} proxy The object whose properties are being intercepted (the JSON data)
	 */
	approximate : function ( handler, proxy ) {
		var def = null;
		proxy = proxy || {};
		var model = {}; // mapping properties that redefine from "function" to "object"
		this._definitions ( handler ).forEach ( function ( key ) {
			def = handler [ key ];
			switch ( gui.Type.of ( def )) {

				/*
				 * Method type functions are skipped, constructors get instantiated. 
				 * Similar (named) property in proxy becomes the constructor argument.
				 */
				case "function" :
					
					/*
					 * TODO: this for edb.MapModel
					 */
					if ( gui.Type.isConstructor ( def )) {
						var C = def;
						model [ key ] = new C ( proxy [ key ]);

						/*
						hotfix [ key ] = true;
						if ( key === "children" ) {
							//alert ( JSON.stringify ( proxy [ key ]));
							alert ( "ObjectModel " + handler [ key ][ 0 ]);
						}
						*/
					}
					break;
				
				/*
				 * TODO: Consider new instance of edb.ObjectModel by default.
				 * TODO: Cosnsider how to guess an object apart from a Map.
				 */
				case "object" :
					console.warn ( "TODO: approximate object: " + key );
					console.warn ( JSON.stringify ( def ));
					break;
					
				/*
				 * TODO: Consider new instance of edb.ArrayModel by default.
				 */
				case "array" :
					console.warn ( "TODO: approximate array: " + key );
					console.warn ( JSON.stringify ( def ));
					break;
					
				/*
				 * Simple properties copied from handler to 
				 * proxy. Strings, numbers, booleans etc.
				 */
				default :
					if ( !gui.Type.isDefined ( proxy [ key ])) {
						proxy [ key ] = handler [ key ];
					}
					break;
			}
		});
		
		/* 
		 * Handler intercepts all accessors for simple properties.
		 */
		gui.Object.nonmethods ( proxy ).forEach ( function ( key ) {
				Object.defineProperty ( handler, key, {
					enumerable : true,
					configurable : true,
					get : function () {
						this.$sub ();
						return model [ key ] || proxy [ key ];
					},
					set : function ( value ) {
						var target = model [ key ] ? model : proxy;
						target [ key ] = value;
						this.$pub ();
					}
				});
		});
	},

	/**
	 * Hello.
	 * @param {object} handler
	 * @returns {Array<String>}
	 */
	_definitions : function ( handler ) {
		var keys = [];
		function fix ( key ) {
			if ( !gui.Type.isDefined ( Object.prototype [ key ])) {
				if ( !gui.Type.isDefined ( edb.Model.prototype [ key ])) {
					if ( !key.startsWith ( "_" )) {
						keys.push ( key );
					}
				}
			}
		}
		for ( var key in handler ) {
			fix ( key );
		}
		return keys;
	}
});