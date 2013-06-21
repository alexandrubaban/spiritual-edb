/**
 * EDB script.
 * @extends {edb.Function}
 */
edb.Script = edb.Function.extend ( "edb.Script", {

	/**
	 * Hijacking the {edb.InputPlugin} which has been 
	 * designed to work without an associated spirit.
	 * @type {edb.InputPlugin}
	 */
	input : null,

	/**
	 * Construct.
	 * @poverloads {edb.Function#onconstruct}
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( context, basedoc, handler ) {
		this._super.onconstruct ( context, basedoc, handler );
		this.input = new edb.InputPlugin ();
		this.input.context = this.context; // as constructor arg?
		this.input.onconstruct (); // huh?
		console.warn ( "Bad: onconstruct should autoinvoke" );
		this._keys = new Set (); // tracking data changes

		// @TODO this *must* be added before it can be removed ?
		gui.Broadcast.addGlobal ( edb.BROADCAST_SETTER, this );
	},

	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} broadcast
	 */
	onbroadcast : function ( b ) {
		this._super.onbroadcast ( b );
		switch ( b.type ) {
			case edb.BROADCAST_GETTER :
				this._keys.add ( b.data );
				break;
			case edb.BROADCAST_SETTER :
				if ( this._keys.has ( b.data )) {
					if ( this.readyState !== edb.Template.WAITING ) {
						var tick = edb.TICK_SCRIPT_UPDATE;
						var sig = this.context.gui.$contextid;
						gui.Tick.one ( tick, this, sig ).dispatch ( tick, 0, sig );	
						this._gostate ( edb.Template.WAITING );
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
				this._gostate ( edb.Template.READY );
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
	 * Run the script. Returns a string.
	 * @overloads {edb.Function#run}
	 * @returns {String}
	 */
	run : function () {
		this._keys = new Set ();
		if ( this.input.done ) {
			return this._super.run.apply ( this, arguments ); 
		} else {
			 throw new Error ( "Script awaits input" );
		}
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
	_resolved : false,

	/**
	 * Hello.
	 */
	_oncompiled : function () {
		gui.Object.each ( this._compiler.inputs, function ( name, type ) {
			this.input.add ( type, this );
		}, this );
		return this._super._oncompiled ();
	},

	/**
	 * Ready to run?
	 * @overloads {edb.Function#_done}
	 * @returns {boolean}
	 */
	_done : function () {
		return this.input.done && this._super._done ();
	}


}, { // Recurring static .......................................................................
	
	/**
	 * @static
	 * Mapping compiled functions to keys.
	 * @type {Map<String,function>}
	 */
	_invokables : new Map (),

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
	assign : function ( func, thisp ) {
		var key = gui.KeyMaster.generateKey ();
		edb.Script._invokables.set ( key, function ( value, checked ) {
			func.apply ( thisp, [ gui.Type.cast ( value ), checked ]);
		});
		return key;
	},

	/**
	 * @static
	 * TODO: Revoke invokable on spirit destruct (release memory)
	 * @param {string} key
	 * @param @optional {String} sig
	 * @param @optional {Map<String,object>} log
	 */
	invoke : function ( key, sig, log ) {
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
			if (( func = this._invokables.get ( key ))) {
				if ( log.type === "click" ) {
					setImmediate ( function () {
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
	register : function ( e ) {
		this._log = {
			type : e.type,
			value : e.target.value,
			checked : e.target.checked
		};
		return this;
	},

	/**
	 * Experimental.
	 * @TODO sort of shadows edb.Function.get !!!!!!!!!!!!!!!!!!!!!!!!!
	 * @param {String} key
	 * @returns {edb.Script}
	 *
	get : function ( key ) {
		return this._scripts [ key ];
	},

	/**
	 * Experimental.
	 * @param {String} key
	 * @param {edb.Script} script
	 *
	set : function ( key, script ) {
		this._scripts [ key ] = script;
	},

	/**
	 * Mapping scripts to keys.
	 * @type {Map<String,edb.Script>}
	 *
	_scripts : Object.create ( null ),

	/**
	 * Load and compile script from SRC.
	 * @param {Window} context
	 * @param {String} src
	 * @param {function} callback
	 * @param {object} thisp
	 *
	loadXXX : function ( context, src, callback, thisp ) {
		new edb.TemplateLoader ( context.document ).load ( src, function ( source ) {
			var url = new gui.URL ( context.document, src );
			var script = edb.Script.get ( url.href ); // todo - localize!
			if ( !script ) {
				this.compileXXX ( context, source, null, function ( script ) {
					edb.Script.set ( url.href, script );
					callback.call ( thisp, script );
				}, this );
			} else {
				callback.call ( thisp, script );
			}
		}, this );
	},

	/**
	 * Compile script from source text.
	 * @param {Window} context
	 * @param {String} src
	 * @param {Mao<String,object>} directives
	 * @param {function} callback
	 * @param {object} thisp
	 *
	compileXXX : function ( context, source, directives, callback, thisp ) {
		var script = new edb.Script ( context, function onreadystatechange () {
			callback.call ( thisp, this );
		});
		script.compile ( source, directives );
	}
	*/

});