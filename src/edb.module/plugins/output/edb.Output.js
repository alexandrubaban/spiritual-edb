/**
 * Note: This plugin is used standalone, so don't reference associated spirit.
 * @todo formalize how this is supposed to be clear
 */
edb.Output = gui.SpiritPlugin.extend ( "edb.Output", {

	/**
	 * Dispatch data as type (eg. instantiate model with JSON and publish the instance on page).
	 * @param {object} data
	 * @param @optional {function|String} type edb.Model constructor or "my.ns.MyModel"
	 */
	dispatch : function ( data, type ) {
		var input = this._format ( data, type );
		if ( input instanceof edb.Input ) {
			if ( input.type ) {
				input.type.output = input; // TODO: RENAME this abomination
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
	 * @deprecated
	 */
	type : function () {
		throw new Error ( "deprecated" );
	},

	
	// PRIVATES .........................................................................
	
	/**
	 * Wrap data in edb.Input before we output.
	 * TODO: DON'T AUTOMATE MODELS, let's just output JSON objects...
	 * @param {object} data
	 * @param @optional {function|String} type
	 * @returns {edb.Input}
	 */
	_format : function ( data, Type ) {

		var result = data;
		if ( data instanceof edb.Input === false ) {
			if ( Type ) {
				Type = this._lookup ( Type );
				if ( data instanceof Type === false ) {
					result = new Type ( data );
				}
			} else if ( !data._instanceKey ) { // TODO: THE WEAKNESS
				switch ( gui.Type.of ( data )) {
					case "object" :
						Type = Object.model ();
						break;
					case "array" :
						Type = Array.model ();
						break;
				}
				result = this._format ( data, Type );
			} else {
				Type = data.constructor;
			}
			result = new edb.Input ( Type, data ); // data.constructor?
		}
		return result;
	},

	/**
	 * Lookup edb.Model constructor for argument (if not it is already).
	 * @todo Check that it is actually an edb.Model thing...
	 * @param {object} arg
	 * @returns {function}
	 */
	_lookup : function ( arg ) {	
		var type = null;
		switch ( gui.Type.of ( arg )) {
			case "function" :
				type = arg;
				break;
			case "string" :
				type = gui.Object.lookup ( arg, this.context );
				break;
			case "object" :
				console.error ( this + ": expected edb.Model constructor (not an object)" );
				break;
		}
		if ( !type ) {
			throw new TypeError ( "The type \"" + arg + "\" does not exist" );
		}
		return type;
	}

});