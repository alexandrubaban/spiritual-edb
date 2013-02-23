/**
 * EDB script.
 * @extends {edb.BaseScript}
 * @param {object} pointer
 * @param {Global} context
 * @param {function} handler
 */
edb.Script = edb.BaseScript.extend ( "edb.Script", {
	
	/**
	 * The window context; where to lookup data types.
	 * @type {Global}
	 */
	context : null,
	
	/**
	 * Target for the "this" keyword in compiled function. For sandboxes, this  
	 * refers to the worker global context; otherwise it's a spirit instance.
	 * @type {object}
	 */
	pointer : null,
	
	/**
	 * Expected script params. Must know how many.
	 * @type {Array<String>}
	 */
	params : null,
	
	/**
	 * Hijacking the "input" plugin which has been 
	 * designed to work without an associated spirit.
	 * @type {edb.Input}
	 */
	input : null,

	/**
	 * Note to self: While loading the function we 
	 * are mapping variable name to function src...
	 * @type {Map<String,function>}
	 */
	functions : null,
	
	/**
	 * Construct.
	 * @param {object} pointer
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( pointer, context, handler ) {
		this._keys = new Set (); // tracking data model changes
		this._super.onconstruct ( pointer, context, handler );
		/*
		 * Redefine these terms into concepts that makes more 
		 * sense when runinng script inside a worker context. 
		 * (related to a future "sandbox" project of some kind)
		 */
		this.pointer = this.spirit; this.spirit = null;
		this.context = this.window; this.window = null;
		// plugin an inputtracker; inject our scope.
		this.input = new edb.InputPlugin ();
		this.input.context = this.context;
		// hey
		this.functions = Object.create ( null );
		// @todo this *must* be added before it can be removed ?????
		gui.Broadcast.addGlobal ( gui.BROADCAST_DATA_PUB, this );
	},
	
	/**
	 * Compile source to invokable function.
	 * @param {String} source
	 * @param {HashMap<String,String>} atts Mapping script tag attributes.
	 * @returns {edb.Script}
	 */
	compile : function ( source, atts ) {
		if ( this._function !== null ) {
			throw new Error ( "not supported: compile script twice" ); // support this?
		}
		// create invokable function (signed for sandbox usage)
		var compiler = new edb.ScriptCompiler ( source, atts );
		if ( this._signature ) {
			compiler.sign ( this._signature );
		}
		// compile source to invokable function
		this._function = compiler.compile ( this.context );
		this._source = compiler.source;
		// copy expected params
		this.params = compiler.params;
		// waiting for functions to load?
		gui.Object.each ( compiler.functions, function ( name, src ) {
			src = new gui.URL ( this.context.document, src ).href;
			var func = edb.Function.get ( src, this.context );
			if ( func ) {
				this.functions [ name ] = func;
			} else {
				gui.Broadcast.addGlobal ( edb.BROADCAST_FUNCTION_LOADED, this );
				this.functions [ name ] = src;
			}
		}, this );
		// waiting for datatypes to load?
		gui.Object.each ( compiler.inputs, function ( name, type ) {
			this.input.add ( type, this );
		}, this );
		try { // in development mode, load invokable function as a blob file; otherwise skip to init
			if ( this._useblob ()) {
				this._loadblob ( compiler );
			} else {
				this._maybeready ();
			}
		} catch ( workerexception ) {
			this._maybeready ();
		}
		return this;
	},

	/**
	 * Log script source to console.
	 */
	debug : function () {
		console.debug ( this._source );
	},

	/**
	 * Sign generated methods for sandbox scenario.
	 * @param {String} signature
	 * @returns {edb.Script}
	 */
	sign : function ( signature ) {
		this._signature = signature;
		return this;
	},
	
	/**
	 * Run the script. Returns a string.
	 * @returns {String} 
	 */
	run : function () { // arguments via apply()
		this._keys = new Set ();
		var error = null;
		var result = null;
		if ( !this._function ) {
			error = "Script not compiled";
		} else if ( !this.input.done ) {
			error = "Script awaits input";
		}
		if ( error !== null ) {
			throw new Error ( error );
		} else {
			this._subscribe ( true );
			result = this._function.apply ( this.pointer, arguments );
			this._subscribe ( false );
		}
		return result;
	},
	
	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} broadcast
	 */
	onbroadcast : function ( broadcast ) {
		switch ( broadcast.type ) {
			case gui.BROADCAST_DATA_SUB :
				var key = broadcast.data;
				this._keys.add ( key );
				break;
			/*
			 * Timeout allows multiple data model 
			 * updates before we rerun the script.
			 */
			case gui.BROADCAST_DATA_PUB :
				if ( this._keys.has ( broadcast.data )) {
					if ( this.readyState !== edb.BaseScript.WAITING ) {
						var tick = edb.TICK_SCRIPT_UPDATE;
						var sig = this.context.gui.signature;
						gui.Tick.one ( tick, this, sig ).dispatch ( tick, 0, sig );	
						this._gostate ( edb.BaseScript.WAITING );
					}
				}
				break;
			case edb.BROADCAST_FUNCTION_LOADED :
				var src = broadcast.data;
				gui.Object.each ( this.functions, function ( name, value ) {
					if ( value === src ) {
						this.functions [ name ] = edb.Function.get ( src, this.context );
					}
				}, this );
				this._maybeready ();
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
				this._gostate ( edb.BaseScript.READY );
				break;
		}
	},
	
	/**
	 * Handle input.
	 * TODO: System for this!
	 * @param {edb.Input} input
	 */
	oninput : function ( input ) {
		this._maybeready ();
	},
	
	
	// PRIVATES ..........................................................................................
	
	/**
	 * Tracking keys in edb.Model and edb.ArrayModel
	 * @type {Set<String>}
	 */
	_keys : null,
	
	/**
	 * TODO: MAKE NOT PRIVATE (used by edb.Function).
	 * Script source compiled to invocable function.
	 * @type {function}
	 */
	_function : null,
	
	/**
	 * Optionally stamp a signature into generated edb.Script.invoke() callbacks.
	 * @type {String} 
	 */
	_signature : null,

	/**
	 * All functions imported?
	 */
	_functionsdone : function () {
		return Object.keys ( this.functions ).every ( function ( name ) {
			return gui.Type.isFunction ( this.functions [ name ]);
		}, this );
	},

	/**
	 * Use blob files?
	 * @returns {boolean} Always false if not development mode
	 */
	_useblob : function () {
		return edb.Script.useblob && 
			this.context.gui.debug && 
			gui.Client.hasBlob && 
			!gui.Client.isExplorer && 
			!gui.Client.isOpera;
	},
	
	/**
	 * In development mode, load compiled script source as a file. 
	 * This allows browser developer tools to assist in debugging. 
	 * Note that this introduces an async step of some kind...
	 * @param {edb.ScriptCompiler} compiler
	 */
	_loadblob : function ( compiler ) {
		var key = gui.KeyMaster.generateKey ( "script" ),
			msg = "// blob script generated in development mode\n",
			src = "function " + key + " (" + this.params + ") { " + msg + compiler.source ( "\t" ) + "\n}",
			win = this.context,
			doc = win.document;
		this._gostate ( edb.BaseScript.LOADING );
		gui.BlobLoader.loadScript ( doc, src, function onload () {
			this._gostate ( edb.BaseScript.WORKING );
			this._function = win [ key ];
			this._maybeready ();
		}, this );
	},

	/**
	 * Report ready? Otherwise waiting 
	 * for data types to initialize...
	 */
	_maybeready : function () {
		if ( this.readyState !== edb.BaseScript.LOADING ) {
			this._gostate ( edb.BaseScript.WORKING );
			if ( this.input.done && this._functionsdone ()) {
				this._gostate ( edb.BaseScript.READY );
			} else {
				this._gostate ( edb.BaseScript.WAITING );
			}
		}
	},
	
	/**
	 * Add-remove broadcast handlers.
	 * @param {boolean} isBuilding
	 */
	_subscribe : function ( isBuilding ) {
		gui.Broadcast [ isBuilding ? "addGlobal" : "removeGlobal" ] ( gui.BROADCAST_DATA_SUB, this );
		gui.Broadcast [ isBuilding ? "removeGlobal" : "addGlobal" ] ( gui.BROADCAST_DATA_PUB, this );
	}
	

}, {}, { // STATICS .....................................................................................
	

	/**
	 * Mount compiled scripts as blob files in development mode for easier debugging?
	 * @todo map to gui.Client.hasBlob somehow...
	 * @type {boolean}
	 */
	useblob : true,
	
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
			gui.Broadcast.dispatchGlobal ( this, gui.BROADCAST_SCRIPT_INVOKE, {
				key : key,
				sig : sig,
				log : log
			});
		} else {
			/*
			 * Timeout is a cosmetic stunt to unfreeze a pressed 
			 * button case the function takes a while to complete. 
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
	 * @param {String} key
	 * @returns {edb.Script}
	 */
	get : function ( key ) {
		return this._scripts [ key ];
	},

	/**
	 * Experimental.
	 * @param {String} key
	 * @param {edb.Script} script
	 */
	set : function ( key, script ) {
		this._scripts [ key ] = script;
	},

	/**
	 * Mapping scripts to keys.
	 * @type {Map<String,edb.Script>}
	 */
	_scripts : Object.create ( null )

});