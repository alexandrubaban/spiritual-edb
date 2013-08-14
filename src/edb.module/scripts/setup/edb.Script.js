/**
 * EDB script.
 * @extends {edb.Function}
 */
edb.Script = edb.Function.extend ({

	/**
	 * Hijacking the {edb.InputPlugin} which has been 
	 * designed to work without an associated spirit.
	 * @type {edb.InputPlugin}
	 */
	input : null,

	/**
	 * Target for the "this" keyword in compiled script.
	 * @type {object}
	 */
	pointer : null,

	/**
	 * Construct.
	 * @poverloads {edb.Function#onconstruct}
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( context, url, handler ) {
		this._super.onconstruct ( context, url, handler );
		this.input = new edb.InputPlugin ();
		this.input.context = this.context; // as constructor arg?
		this.input.onconstruct (); // huh?

		// @TODO this!
		// console.warn ( "Bad: onconstruct should autoinvoke" );

		this._keys = new Set (); // tracking data changes

		// @TODO this *must* be added before it can be removed ?
		gui.Broadcast.addGlobal ( edb.BROADCAST_CHANGE, this );
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} broadcast
	 */
	onbroadcast : function ( b ) {
		switch ( b.type ) {
			case edb.BROADCAST_ACCESS :
				this._keys.add ( b.data );
				break;
			case edb.BROADCAST_CHANGE :
				if ( this._keys.has ( b.data )) {
					if ( this.readyState !== edb.Function.WAITING ) {
						var tick = edb.TICK_SCRIPT_UPDATE;
						var sig = this.context.gui.$contextid;
						gui.Tick.one ( tick, this, sig ).dispatch ( tick, 0, sig );	
						this._gostate ( edb.Function.WAITING );
					}
				}
				break;
		}
	},

	/**
	 * Handle tick.
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {
		switch ( tick.type ) {
			case edb.TICK_SCRIPT_UPDATE :
				this._gostate ( edb.Function.READY );
				break;
		}
	},

	/**
	 * Handle input.
	 * @param {edb.Input} input
	 */
	oninput : function ( input ) {
		this._maybeready (); // see {edb.Function} superclass
	},

	/**
	 * Execute the script, most likely returning a HTML string.
	 * @overrides {edb.Function#execute}
	 * @returns {String}
	 */
	execute : function () {
		this._keys = new Set ();
		var result = null;
		if ( this.input.done ) {
			this._subscribe ( true );
			result = this._super.execute.apply ( this, arguments );
			this._subscribe ( false );
		} else {
			 throw new Error ( "Script awaits input" );
		}
		return result;
	},

	/**
	 * Experimental...
	 */
	dispose : function () {
		this.onreadystatechange = null;
		this.input.ondestruct ();
	},


	// Private ............................................................

	/**
	 * Compiler implementation.
	 * @overwrites {edb.Function#_Compiler}
	 * @type {function}
	 */
	_Compiler : edb.ScriptCompiler,

	/**
	 * Tracking keys in edb.Type and edb.Array
	 * @type {Set<String>}
	 */
	_keys : null,

	/**
	 * Flipped when expected inputs have been determined.
	 * @type {boolean}
	 */
	_inputresolved : false,

	/**
	 * Get compiler implementation.
	 * @returns {function}
	 */
	_compiler : function () {
		return edb.ScriptCompiler;
	},

	/**
	 * Setup input listeners when compiled.
	 * @param {edb.ScriptCompiler} compiler
	 * @param {Map<String,String|number|boolean>} directives
	 * @overrides {edb.Function#_oncompiled}
	 */
	_oncompiled : function ( compiler, directives ) {
		gui.Object.each ( compiler.inputs, function ( name, type ) {
			this.input.add ( type, this );
		}, this );
		this._inputresolved = true;
		this._super._oncompiled ( compiler, directives );
	},

	/**
	 * Ready to run?
	 * @overrides {edb.Function#_done}
	 * @returns {boolean}
	 */
	_done : function () {
		return this._inputresolved && this.input.done && this._super._done ();
	},

	/**
	 * Add-remove broadcast handlers.
	 * @param {boolean} isBuilding
	 */
	_subscribe : function ( isBuilding ) {
		gui.Broadcast [ isBuilding ? "addGlobal" : "removeGlobal" ] ( edb.BROADCAST_ACCESS, this );
		gui.Broadcast [ isBuilding ? "removeGlobal" : "addGlobal" ] ( edb.BROADCAST_CHANGE, this );
	}


}, { // Recurring static .......................................................................
	
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
	_log : null,
	
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
				if ( log.type === "click" ) {
					gui.Tick.next ( function () {
						func ( log.value, log.checked );
					});
				} else {
					func ( log.value, log.checked );
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
		this._log = {
			type : e.type,
			value : e.target.value,
			checked : e.target.checked
		};
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
	}
	
});