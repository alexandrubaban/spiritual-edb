/**
 * @TODO: Clean this up some day.
 */
edb.Script = {

	/**
	 * @static
	 * Map function to generated key and return the key.
	 * @param {function} func
	 * @param {object} thisp
	 * @returns {String}
	 */
	$assign : function ( func, thisp ) {
		var key = gui.KeyMaster.generateKey ();
		edb.Script._invokables [ key ] = function ( value, checked ) {
			return func.apply ( thisp, [ gui.Type.cast ( value ), checked ]);
		};
		return key;
	},

	/**
	 * Garbage collect function that isn't called by the 
	 * GUI using whatever strategy they prefer nowadays.
	 */
	$revoke : function ( key ) {
		edb.Script._invokables [ key ] = null; // garbage one
		delete edb.Script._invokables [ key ]; // garbage two
	},

	/**
	 * @static
	 * TODO: Revoke invokable on spirit destruct (release memory)
	 * @param {string} key
	 * @param @optional {String} sig
	 * @param @optional {Map<String,object>} log
	 */
	$invoke : function ( key, sig, log ) {
		var func = null;
		log = log || this._log;
		/*
		  * Relay invokation to edb.Script in sandboxed context?
		 */
		if ( sig ) {
			gui.Broadcast.dispatchGlobal ( this, edb.BROADCAST_SCRIPT_INVOKE, {
				key : key,
				sig : sig,
				log : log
			});
		} else {
			/*
			 * Timeout is a cosmetic stunt to unfreeze a pressed 
			 * button in case the function takes a while to complete. 
			 */
			if (( func = this._invokables [ key ])) {
				if ( log ) {
					if ( log.type === "click" ) {
						gui.Tick.next ( function () {
							func ( log.value, log.checked );
						});
					} else {
						func ( log.value, log.checked );
					}
				} else {
					func ();
				}
			} else {
				throw new Error ( "Invokable does not exist: " + key );
			}
		}
	},

	/**
	 * Keep a log on the latest DOM event.
	 * @param {Event} e
	 */
	$register : function ( e ) {
		this._log = e ? {
			type : e.type,
			value : e.target.value,
			checked : e.target.checked
		} : null;
		return this;
	},

	/**
	 * Yerh.
	 */
	$tempname : function ( key, sig ) {
		var func;
		if ( sig ) {
			console.error ( "TODO" );
		} else {
			if (( func = this._invokables [ key ])) {
				return func ();
			} else {
				throw new Error ( "out of synch" );
			}
		}
	},
	

	// Private ..................................

	/**
	 * @static
	 * Mapping compiled functions to keys.
	 * @type {Map<String,function>}
	 */
	_invokables : Object.create ( null ),

	/**
	 * Loggin event details.
	 * @type {Map<String,object>}
	 */
	_log : null

};