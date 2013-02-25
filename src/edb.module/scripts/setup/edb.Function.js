/**
 * EDB function.
 * @extends {edb.Template}
 */
edb.Function = edb.Template.extend ( "edb.Function", {

	/**
	 * Compiler implementation (subclass will overwrite it).
	 * @type {function}
	 */
	Compiler : edb.FunctionCompiler,

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
		this._super.onconstruct ( pointer, context, handler );
		/*
		 * Redefine these terms into concepts that makes more 
		 * sense when runinng script inside a worker context. 
		 * (related to a future "sandbox" project of some kind)
		 */
		this.pointer = this.spirit;
		this.context = context;
		this.spirit = null;

		// hey
		this.functions = Object.create ( null );
	},
	
	/**
	 * Compile source to invokable function.
	 * @overwrites {edb.Template#compile}
	 * @param {String} source
	 * @param {HashMap<String,String>} directives
	 * @returns {edb.Function}
	 */
	compile : function ( source, directives ) {
		if ( this._function !== null ) {
			throw new Error ( "not supported: compile script twice" ); // support this?
		}
		// create invokable function (signed for sandbox usage)
		var compiler = this._compiler = new ( this.Compiler ) ( source, directives );
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
				gui.Broadcast.add ( edb.BROADCAST_FUNCTION_LOADED, this, this.context.gui.signature );
				this.functions [ name ] = src;
			}
		}, this );
		/*
		// waiting for datatypes to load?
		gui.Object.each ( compiler.inputs, function ( name, type ) {
			this.input.add ( type, this );
		}, this );
		*/
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
	 * Compiler instance.
	 * @type {edb.FunctionCompiler}
	 */
	_compiler : null,

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
	_loadblob : function ( compiler ) {
		var key = gui.KeyMaster.generateKey ( "script" ),
			msg = "// blob script generated in development mode\n",
			src = "function " + key + " (" + this.params + ") { " + msg + compiler.source ( "\t" ) + "\n}",
			win = this.context,
			doc = win.document;
		this._gostate ( edb.Template.LOADING );
		gui.BlobLoader.loadScript ( doc, src, function onload () {
			this._gostate ( edb.Template.WORKING );
			this._function = win [ key ];
			this._maybeready ();
		}, this );
	},

	/**
	 * Resolve loaded funtion.
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
	 * Report ready? Otherwise waiting 
	 * for data types to initialize...
	 */
	_maybeready : function () {
		if ( this.readyState !== edb.Template.LOADING ) {
			this._gostate ( edb.Template.WORKING );
			if ( this._done ()) {

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
		return Object.keys ( this.functions ).every ( function ( name ) {
			return gui.Type.isFunction ( this.functions [ name ]);
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

}, {}, { // Static ................................................

	/**
	 * Mount compiled scripts as blob files in development mode?
	 * @todo map to gui.Client.hasBlob somehow...
	 * @type {boolean}
	 */
	useblob : true,

	/**
	 * Get function for SRC.
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function}
	 */
	get : function ( src, win ) { // TODO: pass document not window	
		src = new gui.URL ( win.document, src ).href;
		var has = gui.Type.isFunction ( this._map [ src ]);
		if ( !has ) {
			return this._load ( src, win );
		}
		return this._map [ src ];
	},

	// Private static ...............................................

	/**
	 * Mapping src to resolved function.
	 * @type {Map<String,function>}
	 */
	_map : Object.create ( null ),

	/**
	 * Set function for SRC.
	 * @param {String} src
	 * @param {function} func
	 */
	_set : function ( src, func ) {
		this._map [ src ] = func;
	},

	/**
	 * Load function from SRC (async) or lookup in local document (sync).
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function} only if sync (otherwise we wait for broadcast)
	 */
	_load : function ( src, win ) {
		var result = null;
		var sig = win.gui.signature;
		var msg = edb.BROADCAST_FUNCTION_LOADED;
		new edb.TemplateLoader ( win.document ).load ( src, function ( source, directives ) {
			new edb.Function ( null, win, function onreadystatechange () {
				if ( this.readyState === edb.Template.READY ) {
					edb.Function._set ( src, this._function );
					if ( directives.tag ) {
						edb.Tag.set ( win, directives.tag, src );
					}
					if ( directives.debug ) {
						this.debug ();
					}
					gui.Broadcast.dispatch ( null, msg, src, sig );
					result = this._function;
				}
			}).compile ( source, directives );
		});
		return result;
	}

});