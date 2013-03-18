/**
 * Note: This plugin may be used standalone, so don't reference any spirits around here.
 * @TODO formalize how this is supposed to be clear
 * @TODO static interface for all this stuffel
 */
edb.OutputPlugin = gui.Plugin.extend ( "edb.OutputPlugin", {

	/**
	 * Dispatch data as type (eg. instantiate type with JSON and publish the instance on page).
	 * @param {object} data
	 * @param @optional {function|String} type edb.Type constructor or "my.ns.MyType"
	 */
	dispatch : function ( data, Type ) {
		var input = this._format ( data, Type );
		if ( input instanceof edb.Input ) {
			if ( input.type ) {
				input.type.output = input; // TODO: RENAME this abomination
				gui.Broadcast.dispatchGlobal ( 
					this.sandboxed ? null : this.spirit, 
					edb.BROADCAST_OUTPUT, 
					input 
				);
			} else {
				throw new Error ( "edb.Input type is " + input.type );
			}
		} else {
			throw new TypeError ( "Not an instance of edb.Input: " + input );
		}
	},
	
	
	// PRIVATES .........................................................................
	
	/**
	 * Wrap data in edb.Input before we output.
	 * TODO: DON'T AUTOMATE TYPES, let's just output JSON objects. OR WHAT???
	 * @param {object} data
	 * @param @optional {function|String} Type
	 * @returns {edb.Input}
	 */
	_format : function ( data, Type ) {
		if ( data instanceof edb.Input === false ) {
			if ( Type ) {
				Type = this._lookup ( Type );
				if ( data instanceof Type === false ) {
					data = new Type ( data );
				}
			} else if ( !data._instanceid ) { // TODO: THE WEAKNESS
				switch ( gui.Type.of ( data )) {
					case "object" :
						Type = edb.Object.extend ();
						break;
					case "array" :
						Type = edb.Array.extend ();
						break;
				}
				data = this._format ( data, Type );
			} else {
				Type = data.constructor;
			}
			data = new edb.Input ( Type, data ); // data.constructor?
		}
		return data;
	},

	/**
	 * Lookup edb.Type constructor for argument (if not it is already).
	 * @TODO Check that it is actually an edb.Type thing...
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
				console.error ( this + ": expected edb.Type constructor (not an object)" );
				break;
		}
		if ( !type ) {
			throw new TypeError ( "The type \"" + arg + "\" does not exist" );
		}
		return type;
	}

});