/**
 * This fellow compiles a template source string. 
 * The onreadystatechange method fires when ready.
 * The method "run" has then been made available.
 */
edb.BaseScript = gui.Exemplar.create ( "edb.BaseScript", Object.prototype, {
	
	/**
	 * Script may be run when this switches to "ready".
	 * @type {String}
	 */
	readyState : null,
	
	/**
	 * Method is for script users to implement.
	 * @type {function}
	 */
	onreadystatechange : null,
	
	/**
	 * The window context (or any kind of global context).
	 * @type {Window}
	 */
	window : null,
	
	/**
	 * Spirit (or potentital other entity) running the script.
	 * @type {object}
	 */
	spirit : null,
	
	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.BaseScript]";
	},
	
	/**
	 * Construct.
	 * TODO: destruct?
	 * @param {gui.Spirit} spirit
	 * @param {Window} window
	 * @param {function} handler
	 */
	onconstruct : function ( spirit, window, handler ) {
		this.spirit = spirit || null;
		this.window = window || null;
		this.onreadystatechange = handler || null;
	},
	
	/**
	 * @abstract
	 * Compile source to invokable function.
	 * @param {String} source
	 * @param {boolean} debug
	 * @returns {edb.BaseScript}
	 */
	compile : function ( source, debug ) {},
	
	/**
	 * @abstract
	 * Run the script to produce HTML. Arguments via apply().
	 * @returns {String} 
	 */
	run : function () {},
	
	
	// PRIVATES ....................................................................
	
	/**
	 * Update readystate and poke the statechange handler.
	 * @param {String} state
	 */
	_gostate : function ( state ) {
		if ( state !== this.readyState ) {
			this.readyState = state;
			if ( gui.Type.isFunction ( this.onreadystatechange )) {
				this.onreadystatechange ();
			}
		}
	},
	

	// Secrets .....................................................................
	
	/**
	 * Secret constructor. Nothing special.
	 * @param {gui.Spirit} spirit
	 * @param {Window} window
	 * @param {function} handler
	 */
	__construct__ : function ( spirit, window, handler ) {
		this.onconstruct ( spirit, window, handler );
	}	
	
	
}, {}, { // STATICS ................................................................
	
	/**
	 * Used only in development mode (or how was it?).
	 * @type {String}
	 */
	LOADING : "loading",

	/**
	 * @static
	 * Script is waiting for input.
	 * @type {String}
	 */
	WAITING : "waiting",

	/**
	 * @static
	 * Script is processing something.
	 * @type {String}
	 */
	WORKING : "working",

	/**
	 * @static
	 * Script is ready to run.
	 * @type {String}
	 */
	READY : "ready",
	
	/**
	 * Mapping implementations to mimetypes.
	 * @type {Map<String,edb.BaseScript>}
	 */
	_scripts : new Map (),
		
	/**
	 * Register implementation for one or more mimetypes. 
	 * TODO: rename
	 */
	set : function () { // implementation, ...mimetypes
		var args = gui.Type.list ( arguments );
		var impl = args.shift ();
		args.forEach ( function ( type ) {
			this._scripts.set ( type, impl );
		}, this );
	},
	
	/**
	 * Get implementation for mimetype.
	 * TODO: rename
	 * @returns {edb.BaseScript}
	 */
	get : function ( type ) {
		var impl = this._scripts.get ( type );
		if ( !impl ) {
			throw new Error ( "No script engine registered for type: " + type );
		}
		return impl;
	},

	/**
	 * Load and compile script from SRC.
	 * @param {Window} context
	 * @param {String} src
	 * @param {String} type
	 * @param {function} callback
	 * @param {object} thisp
	 */
	load : function ( context, src, type, callback, thisp ) {
		var ScriptLoader = edb.BaseLoader.get ( type || "text/edbml" );
		new ScriptLoader ( context.document ).load ( src, function ( source ) {
			var url = new gui.URL ( context.document, src );
			var script = edb.Script.get ( url.href ); // todo - localize!
			if ( !script ) {
				this.compile ( context, source, type, null, function ( script ) {
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
	 * @param {String} type
	 * @param {Mao<String,object>} extras
	 * @param {function} callback
	 * @param {object} thisp
	 */
	compile : function ( context, source, type, extras, callback, thisp ) {
		var Script = this.get ( type || "text/edbml" );
		var script = new Script ( null, context, function onreadystatechange () {
			if ( this.readyState === edb.BaseScript.READY ) {
				callback.call ( thisp, this );
			}
		});
		script.compile ( source, extras );
	}
});