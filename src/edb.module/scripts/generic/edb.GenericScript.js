/**
 * This fellow compiles a template source string. 
 * The onreadystatechange method fires when ready.
 * The method "run" has then been made available.
 */
edb.GenericScript = gui.Exemplar.create ( "edb.GenericScript", Object.prototype, {
	
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
		return "[object edb.GenericScript]";
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
	 * @returns {edb.GenericScript}
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
	 * Used only in development mode.
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
	 * Hm...
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
	 * @type {Map<String,edb.GenericScript>}
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
	 * @returns {edb.GenericScript}
	 */
	get : function ( type ) {
		var impl = this._scripts.get ( type );
		if ( !impl ) {
			throw new Error ( "No script engine registered for type: " + type );
		}
		return impl;
	}
});