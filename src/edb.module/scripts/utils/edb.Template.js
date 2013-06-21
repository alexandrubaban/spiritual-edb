/**
 * This fellow compiles a template source string. 
 * The onreadystatechange method fires when ready, 
 * the method "run" may by then invoke the script.
 */
edb.Template = gui.Class.create ( "edb.Template", Object.prototype, {
	
	/**
	 * Compiled into this context.
	 * @type {Window|WebWorkerGlobalScope}
	 */
	context : null,

	/**
	 * Experimental...
	 * @type {Document}
	 */
	document : null,

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
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Template]";
	},
	
	/**
	 * Construct.
	 * TODO: destruct?
	 * @param {Window} context
	 * @param {function} handler
	 */
	onconstruct : function ( context, basedoc, handler ) {
		this.context = context || null;
		this.document = basedoc || null;
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
	READY : "ready"
	
});