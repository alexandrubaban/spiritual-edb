/**
 * TODO: comments go here
 */
edb.Output = gui.SpiritPlugin.extend ( "edb.Output", {

	/**
	 * Format data for publication and publish.
	 * @param {object} data
	 * @param @optional {function} type
	 */
	dispatch : function ( data, type ) {
		
		var input = this._format ( data, type );
		if ( input instanceof edb.Input ) {
			if ( input.type ) {
				input.type.output = input; // TODO: RENAME!!!
				gui.Broadcast.dispatchGlobal ( 
					this.sandboxed ? null : this.spirit, 
					gui.BROADCAST_OUTPUT, 
					input 
				);
			} else {
				throw new Error ( "edb.Input type is " + input.type );
			}
		} else {
			throw new TypeError ( "Not an instance of edb.Input: " + input );
		}
	},

	/**
	 * Set output type once and for all.
	 * @param {String} string
	 * @returns {edb.Output}
	 */
	type : function ( arg ) {
		
		var type = null;
		switch ( gui.Type.of ( arg )) {
			case "function" :
				type = arg;
				break;
			case "string" :
				type = gui.Object.lookup ( arg, this.context );
				break;
			case "object" :
				console.error ( this + ": expected function (not object)" );
				break;
		}
		if ( type ) {
			this._type = type;
		} else {
			throw new TypeError ( "The type \"" + arg + "\" does not exist" );
		}
		return this;
	},
	
	
	// PRIVATES .........................................................................
	
	/**
	 * Output model constructor.
	 * @type {function}
	 */
	_type : null,
	 
	/**
	 * Wrap data in edb.Input before we output.
	 * @param {object} data
	 * @param @optional {function} type
	 * @returns {edb.Input}
	 */
	_format : function ( data, type ) {
		
		var result = data, Type = type || this._type;
		if ( data instanceof edb.Input === false ) {
			if ( type ) {
				if ( data instanceof type === false ) {
					data = new Type ( data );
				}
			} else {
				switch ( gui.Type.of ( data )) {
					case "object" :
						type = Object.model ();
						break;
					case "array" :
						type = Array.model ();
						break;
				}
				result = this._format ( data, type );
			}
			result = new edb.Input ( type, data ); // data.constructor?
		}
		return result;
	}
});