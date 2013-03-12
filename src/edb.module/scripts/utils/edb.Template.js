/**
 * This fellow compiles a template source string. 
 * The onreadystatechange method fires when ready, 
 * the method "run" may by then invoke the script.
 */
edb.Template = gui.Class.create ( "edb.Template", Object.prototype, {
	
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
	context : null,
	
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
		return "[object edb.Template]";
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
		this.context = window || null;
		this.onreadystatechange = handler || null;
	},
	
	/**
	 * Compile source to invokable function (open for implementation).
	 * @param {String} source
	 * @param {Map<String,object>} directives
	 * @returns {edb.Template}
	 */
	compile : function ( source, directives ) {},
	
	/**
	 * Run the script to produce some HTML (open for implementation).
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
	 * Register implementation for one or more mimetypes. 
	 * @param {function} implementation
	 * @param {String} mimeype (accepts multiple mimetype args)
	 */
	setImplementation : function () { // implementation, ...mimetypes
		var args = gui.Object.toArray ( arguments );
		var impl = args.shift ();
		args.forEach ( function ( type ) {
			this._implementations.set ( type, impl );
		}, this );
	},
	
	/**
	 * Get implementation for mimetype.
	 * TODO: rename
	 * @returns {edb.Template}
	 */
	getImplementation : function ( type ) {
		var impl = this._implementations.get ( type );
		if ( !impl ) {
			throw new Error ( "No implementation for: " + type );
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
		new edb.TemplateLoader ( context.document ).load ( src, function ( source ) {
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
	 * @param {Mao<String,object>} directives
	 * @param {function} callback
	 * @param {object} thisp
	 */
	compile : function ( context, source, type, directives, callback, thisp ) {
		var Script = this.getImplementation ( type );
		var script = new Script ( null, context, function onreadystatechange () {
			if ( this.readyState === edb.Template.READY ) {
				callback.call ( thisp, this );
			}
		});
		script.compile ( source, directives );
	},


	// Private static .........................................................

	/**
	 * Mapping implementations to mimetypes.
	 * @type {Map<String,edb.Template>}
	 */
	_implementations : new Map ()

});