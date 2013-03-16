/**
 * EDB array-like type.
 * @extends {edb.Type} (although not really)
 */
edb.Array = gui.Class.create ( "edb.Array", Array.prototype, {
	
	/**
	 * Content type.
	 * @type {function} constructor for type (or filter function)
	 */
	$contenttype : null,

	/**
	 * Sugar for $contentype.
	 * @type {function}
	 */
	$of : null,

	/**
	 * Secret constructor.
	 */
	$onconstruct : function () {		
		this._instanceid = this.$instanceid; // iOS strangeness...
		/*
		 * Autoboxing?
		 * TODO: WHAT EXACTLY IS THIS STEP DOING?
		 */
		var C = this.constructor;
		if ( C.__content__ ) {
			this.$contenttype = C.__content__;
			C.__content__ = null;
		}

		if ( arguments.length ) {
			// accept one argument (an array) or use Arguments object as an array
			var args = [];
			if ( gui.Type.isArray ( arguments [ 0 ])) {
				args = arguments [ 0 ];
			} else {
				Array.forEach ( arguments, function ( arg ) {
					args.push ( arg );
				});
			}
			var type = this.$contenttype || this.$of;
			if ( gui.Type.isFunction ( type )) {
				args = args.map ( function ( o, i ) {
					if ( o !== undefined ) { // why can o be undefined in Firefox?
						if ( !o._instanceid ) { // TODO: use instanceOf model
							var Type = type;
							if ( !gui.Type.isConstructor ( Type )) { // model constructor or filter function?
								Type = type ( o );
							}
							o = new Type ( o );
						}
					}
					return o;
				});
			}
			args.forEach ( function ( arg ) {
				Array.prototype.push.call ( this, arg ); // bypass $pub() setup
			}, this );
		}

		// proxy methods and invoke non-secret constructor
		edb.Array.approximate ( this, {});
		this.onconstruct.call ( this, arguments );
	}
	
	
}, { // recurring static fields ............................................................
	
	/**
	 * @TODO don't do this 
	 */
	__data__ : true,
	__content__ : null


}, { // static fields ......................................................................

	/**
	 * Simplistic proxy mechanism: call $sub() on get property and $pub() on set property.
	 * @param {object} handler The object that intercepts properties (the edb.Array)
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
					console.warn ( "TODO: complex stuff on edb.Array :)" );
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
					if ( !gui.Type.isDefined ( edb.Type.prototype [ key ])) {
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
 * Building edb.Array.prototype...
 * @TODO Super support? Mixin the stuff?
 */
( function generatecode () {

	"use strict";
	
	/*
	 * Copy edb.Type methods and properties (manually because we extend from Array).
	 */
	Object.keys ( edb.Type.prototype ).forEach ( function ( def ) {
		this [ def ] = edb.Type.prototype [ def ];
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
	 * @param {edb.Array} other
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
	
}).call ( edb.Array.prototype );