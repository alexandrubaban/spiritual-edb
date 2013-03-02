/**
 * EDB function.
 * @extends {edb.Template}
 */
edb.Function = edb.Template.extend ( "edb.Function", {

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
	 * Note to self: While loading the function we 
	 * are mapping variable name to function src...
	 * @type {Map<String,String|function>}
	 */
	functions : null,

	/**
	 * Experiomental...
	 * @type {Map<String,String|function>} ???????
	 */
	tags : null,
	
	/**
	 * Construct.
	 * @param {object} pointer
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( pointer, context, handler ) {
		this._super.onconstruct ( pointer, context, handler );
		/*
		 * Redefine these terms into concepts that makes more 
		 * sense when runinng script inside a worker context. 
		 * (related to a future "sandbox" project of some kind)
		 */
		this.pointer = this.spirit;
		this.context = context;
		this.spirit = null;

		this.tags = Object.create ( null );
		this.functions = Object.create ( null );
	},
	
	/**
	 * Compile source to function.
	 *
	 * 1. Create the compiler (signed for sandbox usage)
	 * 2. Compile source to invokable function 
	 * 3. Preserve source for debugging
	 * 4. Copy expected params
	 * 5. Load required functions and tags.
	 * 6. Report done whan all is loaded.
	 * @overwrites {edb.Template#compile}
	 * @param {String} source
	 * @param {HashMap<String,String>} directives
	 * @returns {edb.Function}
	 */
	compile : function ( source, directives ) {
		if ( this._function === null ) {
			var compiler = this._compiler = new ( this._Compiler ) ( source, directives );
			if ( this._signature ) { 
				compiler.sign ( this._signature );
			}
			this._function = compiler.compile ( this.context );
			this._source = compiler.source;
			this.params = compiler.params;
			gui.Object.each ( compiler.tags, function ( name, src ) {
				this._tagload ( name, src );
			}, this );
			gui.Object.each ( compiler.functions, function ( name, src ) {
				this._functionload ( name, src );
			}, this );
		} else {
			throw new Error ( "TODO: recompile the script :)" );
		}
		return this._oncompiled ();
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
	 * @returns {edb.Function}
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
		var result = null;
		if ( this._function ) {
			try {
				this._subscribe ( true );
				result = this._function.apply ( this.pointer, arguments );
				this._subscribe ( false );
			} catch ( exception ) {
				console.error ( exception.message + ":\n\n" + this._source );
			}
		} else {
			throw new Error ( "Script not compiled" );
		}
		return result;
	},
	
	/**
	 * Handle broadcast.
	 * @param {gui.Broadcast} broadcast
	 */
	onbroadcast : function ( b ) {
		switch ( b.type ) {
			case edb.BROADCAST_FUNCTION_LOADED :
				this._functionloaded ( b.data );
				break;
			case edb.BROADCAST_TAG_LOADED :
				this._tagloaded ( b.data );
				break;
		}
	},
	
	
	// PRIVATES ..........................................................................................
	
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
	 * Compiler implementation (subclass may overwrite it).
	 * @type {function}
	 */
	_Compiler : edb.FunctionCompiler,

	/**
	 * Compiler instance.
	 * @type {edb.FunctionCompiler}
	 */
	_compiler : null,

	/**
	 * Called when compile is done, as expected.
	 */
	_oncompiled : function () {
		try { // in development mode, load invokable function as a blob file; otherwise skip to init
			if ( this._useblob ()) {
				this._loadblob ();
			} else {
				this._maybeready ();
			}
		} catch ( workerexception ) { // sandbox scenario
			this._maybeready ();
		}
		return this;
	},

	/**
	 * Use blob files?
	 * @returns {boolean} Always false if not development mode
	 */
	_useblob : function () {
		return edb.Function.useblob && 
			this.context.gui.debug && 
			gui.Client.hasBlob && 
			!gui.Client.isExplorer && 
			!gui.Client.isOpera;
	},
	
	/**
	 * In development mode, load compiled script source as a file. 
	 * This allows browser developer tools to assist in debugging. 
	 * Note that this introduces an async step of some kind...
	 * @param {edb.FunctionCompiler} compiler
	 */
	_loadblob : function () {
		var win = this.context;
		var doc = win.document;
		var key = gui.KeyMaster.generateKey ( "function" );
		var src = this._compiler.source.replace ( "function", "function " + key );
		this._gostate ( edb.Template.LOADING );
		gui.BlobLoader.loadScript ( doc, src, function onload () {
			this._gostate ( edb.Template.WORKING );
			this._function = win [ key ];
			this._maybeready ();
		}, this );
	},

	/**
	 * Load function from src.
	 * @param {String} name
	 * @param {String} src
	 */
	_tagload : function ( name, src ) {
		src = gui.URL.absolute ( this.context.document, src );
		var tag = edb.Tag.get ( src, this.context );
		if ( tag ) {
			this.tags [ name ] = tag;
		} else {
			this._await ( edb.BROADCAST_TAG_LOADED, true );
			this.tags [ name ] = src;
		}
	},

	/**
	 * Load function from src.
	 * @param {String} name
	 * @param {String} src
	 */
	_functionload : function ( name, src ){
		src = gui.URL.absolute ( this.context.document, src );
		var func = edb.Function.get ( src, this.context );
		if ( func ) {
			this.functions [ name ] = func;
		} else {
			this._await ( edb.BROADCAST_FUNCTION_LOADED, true );
			this.functions [ name ] = src;
		}
	},

	/**
	 * Funtion loaded from src.
	 * @param {String} src
	 */
	_functionloaded : function ( src ) {
		gui.Object.each ( this.functions, function ( name, value ) {
			if ( value === src ) {
				this.functions [ name ] = edb.Function.get ( src, this.context );
			}
		}, this );
		this._maybeready ();
	},

	/**
	 * Funtion loaded from src.
	 * @param {String} src
	 */
	_tagloaded : function ( src ) {
		gui.Object.each ( this.tags, function ( name, value ) {
			if ( value === src ) {
				this.tags [ name ] = edb.Tag.get ( src, this.context );
			}
		}, this );
		this._maybeready ();
	},

	/**
	 * Watch for incoming functions and tags.
	 * @param {boolean} add
	 */
	_await : function ( msg, add ) {
		var act = add ? "add" : "remove";
		var sig = this.context.gui.signature;
		gui.Broadcast [ act ] ( msg, this, sig );
	},

	/*
	_arrive : function () {
		TODO!
	},
	*/

	/**
	 * Report ready? Otherwise waiting 
	 * for data types to initialize...
	 */
	_maybeready : function () {
		if ( this.readyState !== edb.Template.LOADING ) {
			this._gostate ( edb.Template.WORKING );
			if ( this._done ()) {
				this._await ( edb.BROADCAST_TAG_LOADED, false );
				this._await ( edb.BROADCAST_FUNCTION_LOADED, false );
				this._gostate ( edb.Template.READY );
			} else {
				this._gostate ( edb.Template.WAITING );
			}
		}
	},

	/**
	 * Ready to run?
	 * @returns {boolean}
	 */
	_done : function () {
		return [ "functions", "tags" ].every ( function ( map ) {
			return Object.keys ( this [ map ] ).every ( function ( name ) {
				return gui.Type.isFunction ( this [ map ][ name ]);
			}, this );
		}, this );
	},
	
	/**
	 * Add-remove broadcast handlers.
	 * @param {boolean} isBuilding
	 */
	_subscribe : function ( isBuilding ) {
		gui.Broadcast [ isBuilding ? "addGlobal" : "removeGlobal" ] ( gui.BROADCAST_DATA_SUB, this );
		gui.Broadcast [ isBuilding ? "removeGlobal" : "addGlobal" ] ( gui.BROADCAST_DATA_PUB, this );
	}


}, { // Recurring static ................................................

	/**
	 * Get function for SRC.
	 * @todo pass document not window	
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function}
	 */
	get : function ( src, win ) {
		if ( !win ) throw new Error ( "NO!" );
		src = new gui.URL ( win.document, src ).href;
		var has = gui.Type.isFunction ( this._map [ src ]);
		if ( !has ) {
			return this._load ( src, win );
		}
		return this._map [ src ];
	},


	// Private recurring static ...........................................

	/**
	 * Message to dispatch when function is loaded. 
	 * The function src appears as broadcast data.
	 * @type {String}
	 */
	_broadcast : edb.BROADCAST_FUNCTION_LOADED,

	/**
	 * Mapping src to (loaded and compiled) function.
	 * @type {Map<String,function>}
	 */
	_map : Object.create ( null ),

	/**
	 * Load function from SRC (async) or lookup in local document (sync).
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function} only if sync (otherwise we wait for broadcast)
	 */
	_load : function ( src, win ) {
		var func = null, 
			Implementation = this, 
			cast = this._broadcast, 
			sig = win.gui.signature;
		new edb.TemplateLoader ( win.document ).load ( src, onload );
		function onload ( source, directives ) {
			new Implementation ( null, win, function onreadystatechange () {
				if ( this.readyState === edb.Template.READY ) {
					func = Implementation._map [ src ] = this._function;
					if ( directives.debug ) {
						this.debug ();
					}
					gui.Broadcast.dispatch ( null, cast, src, sig );
				}
			}).compile ( source, directives );
		}
		return func;
	}


}, { // Static ...................................................

	/**
	 * Mount compiled scripts as blob files in development mode?
	 * @todo map to gui.Client.hasBlob somehow...
	 * @type {boolean}
	 */
	useblob : true

});