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
	 * Mapping dependencies while booting, converted to functions once resolved.
	 * @type {Map<String,edb.Dependency|function>}
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
		this.functions = Object.create ( null );
		/*
		 * Redefine these terms into concepts that makes more 
		 * sense when runinng script inside a worker context. 
		 * (related to a future "sandbox" project of some kind)
		 */
		this.pointer = this.spirit;
		this.context = context;
		this.spirit = null;
	},
	
	/**
	 * Compile source to function.
	 *
	 * 1. Create the compiler (signed for sandbox usage)
	 * 2. Compile source to invokable function 
	 * 3. Preserve source for debugging
	 * 4. Copy expected params
	 * 5. Load required functions.
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
			this._dependencies ( compiler );
		} else {
			throw new Error ( "TODO: recompile the script :)" );
		}
		return this._oncompiled ();
	},

	/**
	 * Log script source to console.
	 */
	debug : function () {
		if(this._debugt){
			throw new Error ( "WHY TWICE?" );
		}
		this._debugt = true;
		console.debug ( this._source );
	},

	/**
	 * Resolve dependencies.
	 * @param {edb.Compiler} compiler
	 */
	_dependencies : function ( compiler ) {
		compiler.dependencies.filter ( function ( dep ) {
			return true; // return dep.type === edb.Dependency.TYPE_FUNCTION;
		}).map ( function ( dep ) {
			this.functions [ dep.name ] = null; // null all first
			return dep;
		}, this ).forEach ( function ( dep ) {
			dep.resolve ().then ( function ( resolved ) {
				this.functions [ dep.name ] = resolved;
				this._maybeready ();
			}, this );
		}, this );
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
	 * Called when compile is done, as expected. In development mode, 
	 * load invokable function as a blob file; otherwise skip to init.
	 */
	_oncompiled : function () {
		try {
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
			return this.functions [ name ] !== null;
		}, this );
	},
	
	/**
	 * Add-remove broadcast handlers.
	 * @param {boolean} isBuilding
	 */
	_subscribe : function ( isBuilding ) {
		gui.Broadcast [ isBuilding ? "addGlobal" : "removeGlobal" ] ( edb.BROADCAST_GETTER, this );
		gui.Broadcast [ isBuilding ? "removeGlobal" : "addGlobal" ] ( edb.BROADCAST_SETTER, this );
	}


}, { // Recurring static ................................................

	/**
	 * Get function for SRC.
	 * @param {Window} win
	 * @param {String} src
	 * @returns {function}
	 */
	get : function ( win, src ) {
		//alert ( this + " : Getting " + src )
		src = new gui.URL ( win.document, src ).href;
		if ( !gui.Type.isFunction ( this._map [ src ])) {
			return this._load ( src, win );
		}
		return this._map [ src ] || null;
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
		//alert( this + " loading " + src );
		var func = null, 
			Implementation = this, 
			cast = this._broadcast, 
			sig = win.gui.signature;
		new edb.TemplateLoader ( win.document ).load ( src,
			function onload ( source, directives ) {
				if ( source ) {
					new Implementation ( null, win, function onreadystatechange () {
						if ( this.readyState === edb.Template.READY ) {
							func = Implementation._map [ src ] = this._function;
							if ( directives.debug ) {
								//alert( this + " ready " + src);
								this.debug ();
							}
							gui.Broadcast.dispatch ( null, cast, src, sig );
						}
					}).compile ( source, directives );
				}
			}
		);
		return func;
	}


}, { // Static ...................................................

	/**
	 * Mount compiled scripts as blob files in development mode?
	 * @TODO map to gui.Client.hasBlob somehow...
	 * @type {boolean}
	 */
	useblob : true

});

/**
 * Allow function get to be thrown around. 
 * Might benefit some template readability.
 */
( function bind () {
	edb.Function.get = edb.Function.get.bind ( edb.Function );
}());