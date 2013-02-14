/**
 * The ScriptPlugin renders the spirit HTML subtree somewhat like a template engine.
 * @extends {gui.Plugin} (should perhaps extend some kind of genericscriptplugin)
 */
edb.ScriptPlugin = gui.Plugin.extend ( "edb.ScriptPlugin", {

	/**
	 * We don't really handle anything else.
	 * @type {String}
	 */
	type : "text/edbml",

	/**
	 * The Script SRC must be set *before* spirit.onenter() 
	 * to automatically load when spirit enters the DOM. 
	 * @todo Perhaps a setter to fix this defect
	 * @type {String}
	 */
	src : null,

	/**
	 * Flipped after first run.
	 * @type {boolean}
	 */
	ran : false,

	/**
	 * Use minimal updates (let's explain exactly what this is)?
	 * If false, we write the entire HTML subtree on all updates. 
	 * @type {boolean}
	 */
	diff : true,

	/**
	 * Log development stuff to console?
	 * @todo Move this to "extras" below..,
	 * @type {boolean}
	 */
	debug : false,

	/**
	 * Hm...
	 * @type {Map<String,object>}
	 */
	extras : null,

	/**
	 * Automatically run script as soon as possible?
	 *
	 * 1. On startup if no input data is expected
	 * 2. Otherwise, when all input data is collected
	 * @type {Boolean}
	 */
	autorun : true,
	
	/**
	 * Construction time.
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		if ( this.spirit instanceof edb.ScriptSpirit ) {
			this.autorun = false;
		}
		if ( this.diff ) {
			this._updater = new edb.UpdateManager ( this.spirit );
		}
		if ( this.src ) {
			this.load ( this.src );
		}
	},

	/**
	 * Load script from SRC (async unless source points 
	 * to a script embedded in spirits own document). 
	 * @param {String} src 
	 * @param @optional {String} type Script mimetype (eg "text/edbml")
	 */
	load : function ( src, type ) {
		var ScriptLoader = edb.BaseLoader.get ( type || "text/edbml" );
		new ScriptLoader ( this.spirit.document ).load ( src, function ( source ) {
			this.compile ( source, this.type, this.debug );
		}, this );
	},
	
	/**
	 * Mapping imported functions to declared variable names.
	 * @returns {Map<String,function>}
	 */
	functions : function () {
		return this._script.functions;
	},

	/**
	 * Thing to resolve expected script input (edb.Data objects).
	 * returns {edb.Input}
	 */
	input : function () {
		return this._script.input;
	},

	/**
	 * Compile script and run it when ready.
	 * @param {String} source Script source code
	 * @param @optional {String} type Script mimetype (eg "text/edbml")
	 * @param @optional {boolean} debug Log something to console
	 * @param @optional {HashMap<String,String>} extras Optional compiler directives
	 */
	compile : function ( source, type, debug, extras ) {
		var Script = edb.BaseScript.get ( type || "text/edbml" );
		if ( !this._script ) {
			var that = this, spirit = this.spirit, context = spirit.window;
			this._script = new Script ( spirit, context, function onreadystatechange () {
				if ( this.readyState === edb.BaseScript.READY ) {
					that._compiled ();
				}
			});
			this._script.compile ( source, debug, extras );
		} else {
			throw new Error ( "not supported: recompile edb.ScriptPlugin" ); // support this?
		}
	},

	consume : function () {},
	
	/**
	 * Run script (with implicit arguments) and write result to DOM.
	 * @see {gui.SandBoxView#render}
	 */
	run : function () {		
		if ( this._script ) {
			this.write ( 
				this._script.run.apply ( 
					this._script, 
					arguments 
				)
			);
		} else {
			console.warn ( "Running uncompiled script" );
		}
	},
	
	/**
	 * Write the actual HTML to screen. You should probably only 
	 * call this method if you are producing your own markup 
	 * somehow, ie. not using EDBML templates out of the box. 
	 * @todo Only do something if string argument has diffed 
	 * @param {String} html
	 */
	write : function ( html ) {
		if ( this.diff ) {
			this._updater.update ( html );
		} else {
			this.spirit.dom.html ( html ); // TODO: forms markup make valid!
		}
		this.ran = true;
		this.spirit.life.dispatch ( 
			edb.LIFE_SCRIPT_DID_RUN,  
			( this._latest = html ) !== this._latest // @todo Support this kind of arg...
		);
		this.spirit.action.dispatchGlobal ( gui.ACTION_DOCUMENT_FIT ); // emulate seamless iframes (?)
	},
	

	// PRIVATES ...........................................................................

	/**
	 * Hello.
	 * @type {edb.Script}
	 */
	_script : null,

	/**
	 * Update manager. 
	 * @type {edb.UpdateManager}
	 */
	_updater : null,

	/**
	 * Script compiled.
	 * @todo life-event should probably go here...
	 */
	_compiled : function () {
		if ( this.autorun ) {
			this.run ();
		}
	}


}, { // STATICS .........................................................................

	/**
	 * @type {boolean}
	 */
	lazy : false

});
