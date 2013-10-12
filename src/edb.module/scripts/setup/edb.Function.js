/**
 * This fellow compiles an EDBML source string into an executable 
 * JS function. The onreadystatechange method fires when ready. 
 * The method "execute" may by then invoke the compiled function.
 */
edb.Function = gui.Class.create ( Object.prototype, {
	
	/**
	 * EDBML source compiled to executable JS function.
	 * @type {function}
	 */
	executable : null,

	/**
	 * Executable JS function compiled into this context.
	 * @type {Window|WorkerGlobalScope}
	 */
	context : null,

	/**
	 * Origin of the EDBML template (specifically in 'url.href')
	 * @type {gui.URL}
	 */
	url : null,

	/**
	 * Function may be executed when this switches to 'ready'. 
	 * You can overwrite the onreadystatechange method below.
	 * @type {String}
	 */
	readyState : null,
	
	/**
	 * Overwrite this to get notified on readyState changes. 
	 * The method recieves the {edb.Function} as an argument.
	 * @type {function}
	 */
	onreadystatechange : null,
	
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
		this._imports = Object.create ( null );
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
		if ( this.executable === null ) {
			var Compiler = this._compiler ();
			var compiler = new Compiler ( source, directives );
			if ( this._$contextid ) {
				compiler.sign ( this._$contextid );
			}
			this.executable = compiler.compile ( this.context, this.url );
			this._source = compiler.source;
			this._dependencies ( compiler );
			this._oncompiled ( compiler, directives );
			return this;
		} else {
			throw new Error ( "TODO: recompile the script :)" );
		}
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
		compiler.dependencies.map ( function ( dep ) {
			this._imports [ dep.name ] = null; // null all first
			return dep;
		}, this ).forEach ( function ( dep ) {
			dep.resolve ().then ( function ( resolved ) {
				this._imports [ dep.name ] = resolved;
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
	 * Execute compiled function, most likely returning a HTML string.
	 * @returns {String} 
	 */
	execute : function ( /* arguments */ ) {
		var result = null;
		if ( this.executable ) {
			try {
				this._subscribe ( true );
				result = this.executable.apply ( this.pointer, arguments );
				this._subscribe ( false );
			} catch ( exception ) {
				console.error ( exception.message + ":\n\n" + this._source );
			}
		} else {
			throw new Error ( this + " not compiled" );
		}
		return result;
	},
	

	// PRIVATES ..........................................................................................
	
	/**
	 * Optionally stamp a $contextid into generated edb.Script.invoke() callbacks.
	 * @type {String} 
	 */
	_$contextid : null,

	/**
	 * Tracking imported functions.
	 * 
	 * 1. Mapping {edb.Import} instances while booting
	 * 2. Mapping {edb.Function} instances once resolved.
	 * @type {Map<String,edb.Import|function>}
	 */
	_imports : null,

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
	 * @param {Map<String,String|number|boolean>} directives
	 */
	_oncompiled : function ( compiler, directives ) {
		if ( directives.debug ) {
			this.debug ();
		}
		try {
			if ( this._useblob ()) {
				this._loadblob ( compiler );
			} else {
				this._maybeready ();
			}
		} catch ( workerexception ) { // TODO: sandbox scenario
			this._maybeready ();
		}
	},

	/**
	 * Use blob files? Temp disabled in Firefox due to sandbox issues.
	 * @TODO: Investigate potential overheads and asyncness
	 */
	_useblob : function () {
		return this.context.gui.debug && gui.Client.isWebKit;
		/*
		return this.context.edb.useblobs && 
			gui.Client.hasBlob && 
			!gui.Client.isExplorer && 
			!gui.Client.isOpera;
		*/
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
			this.executable = win [ key ];
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
		return Object.keys ( this._imports ).every ( function ( name ) {
			return this._imports [ name ] !== null;
		}, this );
	}


}, { // Recurring static ................................................

	/**
	 * Get function loaded from given SRC and compiled into given context.
	 * @param {Window} context
	 * @param {String} src
	 * @returns {function}
	 */
	get : function ( context, src ) {
		var ex = this._executables;
		var id = context.gui.$contextid;
		if ( gui.URL.absolute ( src )) {
			return ex [ id ] ? ex [ id ][ src ] || null : null;
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
		var exe = this._executablecontext ( context );
		new edb.Loader ( basedoc ).load ( src, function onload ( source, directives, url ) {
			this.compile ( context, url, source, directives, function onreadystatechange ( fun ) {
				if ( !exe [ url.href ] && fun.readyState === edb.Function.READY ) {
					exe [ url.href ] = fun.executable; // now avilable using edb.Function.get()
				}
				callback.call ( thisp, fun );
			});
		}, this );
	},

	/**
	 * Compile EDBML source to {edb.Function} instance in given context.
	 * @TODO: If <SCRIPT> has an id, we can store this in _executables...
	 * @param {Window} context
	 * @param {gui.URL} url
	 * @param {String} src
	 * @param {Map<String,String|number|boolean>} directives
	 * @param {function} callback
	 * @param {object} thisp
	 */
	compile : function ( context, url, source, directives, callback, thisp ) {
		var Fun = this;
		new Fun ( context, url, function onreadystatechange () {
			callback.call ( thisp, this );
		}).compile ( source, directives );
	},


	// Private recurring static ..............................................................

	/**
	 * Mapping contextid to map that maps URIs to functions.
	 * @type {Map<String,Map<String,function>>}
	 */
	_executables : Object.create ( null ),

	/**
	 * Get (and possibly create) map for context.
	 * @param {Window} context
	 * @returns {Map<String,function>}
	 */
	_executablecontext : function ( context ) {
		var exe = this._executables, id = context.gui.$contextid;
		return exe [ id ] || ( exe [ id ] = Object.create ( null ));
	}


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