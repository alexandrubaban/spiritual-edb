/**
 * EDB function.
 * @extends {edb.Template}
 */
edb.Function = gui.Class.create ( "edb.Function", Object.prototype, {
	
	/**
	 * Compiled into this context.
	 * @type {Window|WebWorkerGlobalScope}
	 */
	context : null,

	/**
	 * Experimental...
	 * @type {gui.URL}
	 */
	url : null,

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
	 * Expected script params. Must know how many.
	 * @type {Array<String>}
	 */
	params : null,

	/**
	 * Mapping edb.Dependencies while booting - mapping functions once resolved.
	 * @type {Map<String,edb.Dependency|function>}
	 */
	functions : null,
	
	/**
	 * Construct.
	 * @param {Document} basedoc
	 * @param {Global} context
	 * @param {function} handler
	 */
	onconstruct : function ( context, url, handler ) {
		this.context = context || null;
		this.url = url || null;
		this.onreadystatechange = handler || null;
		this.functions = Object.create ( null );
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
	compile : function ( source, directives ) { // @TODO gui.Combo.chained
		if ( this._function === null ) {
			var compiler = new ( this._compiler ()) ( source, directives );
			if ( this._$contextid ) {
				compiler.sign ( this._$contextid );
			}
			this._function = compiler.compile ( this.context, this.url );
			this._source = compiler.source;
			this.params = compiler.params;
			this._dependencies ( compiler );
		} else {
			throw new Error ( "TODO: recompile the script :)" );
		}
		console.debug ( "TEMP\n"+this._source );
		return this._oncompiled ( compiler );
	},

	/**
	 * Log function source to console.
	 */
	debug : function () {
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
	 * @param {String} $contextid
	 * @returns {edb.Function}
	 */
	sign : function ( $contextid ) {
		this._$contextid = $contextid;
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
	 * TODO: What is this doing?
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
	 * Optionally stamp a $contextid into generated edb.Script.invoke() callbacks.
	 * @type {String} 
	 */
	_$contextid : null,

	/**
	 * Get compiler implementation (subclass may overwrite this method).
	 * @returns {function}
	 */
	_compiler : function () {
		return edb.FunctionCompiler;
	},

	/**
	 * If supported, load invokable function 
	 * as blob file. Otherwise skip to init.
	 * @param {edb.FunctionCompiler} compiler
	 */
	_oncompiled : function ( compiler ) {
		try {
			if ( this._useblob ()) {
				this._loadblob ( compiler );
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
	 * @TODO: Investigate potential overheads and asyncness
	 */
	_useblob : function () {
		return this.context.edb.useblobs && 
			gui.Client.hasBlob && 
			!gui.Client.isExplorer && 
			!gui.Client.isOpera;
	},
	
	/**
	 * Mount compiled function as file. 
	 * @param {edb.Compiler} compiler
	 */
	_loadblob : function ( compiler ) {
		var win = this.context;
		var doc = win.document;
		var key = gui.KeyMaster.generateKey ();
		var src = compiler.source.replace ( "function", "function " + key );
		this._gostate ( edb.Function.LOADING );
		gui.BlobLoader.loadScript ( doc, src, function onload () {
			this._gostate ( edb.Function.WORKING );
			this._function = win [ key ];
			this._maybeready ();
		}, this );
	},

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

	/**
	 * Report ready? Otherwise waiting 
	 * for data types to initialize...
	 */
	_maybeready : function () {
		if ( this.readyState !== edb.Function.LOADING ) {
			this._gostate ( edb.Function.WORKING );
			if ( this._done ()) {
				this._gostate ( edb.Function.READY );
			} else {
				this._gostate ( edb.Function.WAITING );
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
	 * Get function loaded from given SRC and compiled into given context.
	 * @TODO: Actually use the context to support multiple contexts!!!!!!! 
	 * @param {Window} context
	 * @param {String} src
	 * @returns {function}
	 */
	get : function ( context, src ) {
		if ( gui.URL.absolute ( src )) {
			return this._functions [ src ] || null;
		} else {
			throw new Error ( "Absolute URL expected" );
		}
	},

	/**
	 * Loaded and compile function for SRC. When compiled, you can 
	 * get the invokable function using 'edb.Function.get()' method. 
	 * @param {Window} context Compiler target context
	 * @param {Document} basedoc Used to resolve relative URLs
	 * @param {String} src Document URL to load and parse (use #hash to target a SCRIPT id)
	 * @param {function} callback
	 * @param {object} thisp
	 */
	load : function ( context, basedoc, src, callback, thisp ) {
		var functions = this._functions;
		new edb.Loader ( basedoc ).load ( src, function onload ( source, directives, url ) {
			this.compile ( context, url, source, directives, function onreadystatechange ( script ) {
				if ( !functions [ url.href ] && script.readyState === edb.Function.READY ) {
					functions [ url.href ] = script._function; // now avilable using edb.Function.get()
				}
				callback.call ( thisp, script );
			});
		}, this );
	},

	/**
	 * Compile source text to {edb.Function} instance.
	 * @param {Window} context
	 * @param {Document} basedoc
	 * @param {String} src
	 * @param {Mao<String,object>} directives
	 * @param {function} callback
	 * @param {object} thisp
	 */
	compile : function ( context, url, source, directives, callback, thisp ) {
		new ( this ) ( context, url, function onreadystatechange () {
			callback.call ( thisp, this );
		}).compile ( source, directives );
	},


	// Private recurring static ..............................................................

	/**
	 * Mapping SRC to invokable function.
	 * TODO: rename 'invokabels' or 'executabeles' or something (since it's not edb.Functions)
	 * TODO: Get $contextid in here, othewise windows will overwrite eachother!!!
	 * @type {Map<String,function>}
	 */
	_functions : Object.create ( null )


}, { // Static .............................................................................

	/**
	 * Function is loading.
	 * @type {String}
	 */
	LOADING : "loading",

	/**
	 * Function is waiting for something.
	 * @type {String}
	 */
	WAITING : "waiting",

	/**
	 * Function is processing something.
	 * @type {String}
	 */
	WORKING : "working",

	/**
	 * Function is ready to run.
	 * @type {String}
	 */
	READY : "ready"

});

/**
 * Allow function get to be thrown around. 
 * Might benefit some template readability.
 */
( function bind () {
	edb.Function.get = edb.Function.get.bind ( edb.Function );
}());