/**
 * Array-like data model. Aliased as Array.model ();
 */
edb.ArrayModel = gui.Exemplar.create ( Array.prototype, {
	
	/**
	 * Autoboxed data model.
	 * @type {function} model constructor (or filter function)
	 */
	$contentmodel : null,

	/**
	 * Secret constructor.
	 */
	__construct__ : function () {		
		this._instanceKey = gui.KeyMaster.generateKey ();
		/*
		 * Autoboxing?
		 * TODO: WHAT EXACTLY IS THIS STEP DOING?
		 */
		var C = this.constructor;
		if ( C.__content__ ) {
			this.$contentmodel = C.__content__;
			C.__content__ = null;
		}
		/*
		 * TODO: sample for type Object or Array and autocast autoboxing!
		 */
		if ( gui.Type.isDefined ( arguments [ 0 ])) {
			// accept one argument (an array) or use Arguments object as an array
			var input = [];
			if ( gui.Type.isArray ( arguments [ 0 ])) {
				input = arguments [ 0 ];
			} else {
				Array.forEach ( arguments, function ( arg ) {
					input.push ( arg );
				});
			}
			// TODO: this less cryptic
			var boxer = this.$contentmodel || this.$cm;
			if ( gui.Type.isFunction ( boxer )) {
				input.forEach ( function ( o, i ) {
					if ( o !== undefined ) { // why can o be undefined in Firefox?
						if ( !o._instanceKey ) { // TODO: use instanceOf model
							var Model = boxer;
							if ( !gui.Type.isConstructor ( Model )) { // model constructor or filter function?
								Model = boxer ( o ); // was: if ( !model.__data__ )...
							}
							o = new Model ( o );
						}
						Array.prototype.push.call ( this, o ); // bypass $pub() setup
					}
				}, this );
			}
		}
		// proxy methods and invoke non-secret constructor
		edb.ArrayModel.approximate ( this, {});
		this.onconstruct ();
	}
	
	
}, { // recurring static fields .........................................
	
	__name__ : "DataList",
	__data__ : true,
	__content__ : null


}, { // static fields ............................................

	/**
	 * Simplistic proxy mechanism: call $sub() on get property and $pub() on set property.
	 * @param {object} handler The object that intercepts properties (the edb.ArrayModel)
	 * @param {object} proxy The object whose properties are being intercepted (raw JSON data)
	 */
	approximate : function ( handler, proxy ) {
		
		var def = null;
		proxy = proxy || {};	
		this._definitions ( handler ).forEach ( function ( key ) {
			def = handler [ key ];
			switch ( gui.Type.of ( def )) {
				case "function" :
					break;
				case "object" :
				case "array" :
					console.warn ( "TODO: complex stuff on edb.ArrayModel :)" );
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
					return proxy [ key ];
				},
				set : function ( value ) {
					proxy [ key ] = value;
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
			if ( !gui.Type.isNumber ( gui.Type.cast ( key ))) {
				if ( !gui.Type.isDefined ( Array.prototype [ key ])) {
					if ( !gui.Type.isDefined ( edb.Model.prototype [ key ])) {
						if ( !key.startsWith ( "_" )) {
							keys.push ( key );
						}
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

/*
 * Building edb.ArrayModel.prototype...
 */
( function generatecode () {

	"use strict";
	
	/*
	 * Copy edb.Model methods and properties (manually because we extend from Array).
	 */
	Object.keys ( edb.Model.prototype ).forEach ( function ( def ) {
		this [ def ] = edb.Model.prototype [ def ];
	}, this );
	
	/*
	 * Whenever the list is inspected or traversed, method $sub() should be invoked.
	 * TODO: make this mechanism public for easy expando
	 */
	[
		"filter", 
		"forEach", 
		"every", 
		"map", 
		"some", 
		"indexOf", 
		"lastIndexOf"
	].forEach ( function ( method ) {
		this [ method ] = function () {
			var result = Array.prototype [ method ].apply ( this, arguments );
			this.$sub ();
			return result;
		};
	}, this );
	
	/*
	 * Whenever the list changes content or structure, method $pub() should be invoked.
	 * TODO: Alwasy validate that added entries match the interface of autoboxed type...
	 * TODO: make this mechanism public for easy expando
	 */
	[
		"push",
		"pop", 
		"shift", 
		"unshift", 
		"splice", 
		"reverse" 
	].forEach ( function ( method ) {
		this [ method ] = function () {
			var result = Array.prototype [ method ].apply ( this, arguments );
			this.$pub ();
			return result;
		};
	}, this );
	
	/*
	 * TODO: This is wrong on so many...
	 * @param {edb.ArrayModel} other
	 */
	this.concat = function ( other ) {
		var clone = new this.constructor (); // must not construct() the instance!
		this.forEach ( function ( o ) {
			clone.push ( o );
		});
		other.forEach ( function ( o ) {
			clone.push ( o );
		});
		return clone;
	};
	
}).call ( edb.ArrayModel.prototype );