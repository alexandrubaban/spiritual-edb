/**
 * The ScriptPlugin shall render the spirits HTML.
 * @extends {gui.Plugin} (should perhaps extend some kind of genericscriptplugin)
 */
edb.ScriptPlugin = gui.Plugin.extend ( "edb.ScriptPlugin", {
	
	/**
	 * The {gui.BaseScript} is rigged up to support alternative 
	 * template languages, but we default to EDBML around here.
	 * @type {String}
	 */
	type : "text/edbml",

	/**
	 * The Script SRC must be set before spirit.onenter() 
	 * to automatically load when spirit enters the DOM.
	 * @type {String}
	 */
	src : null,

	/**
	 * True when there's a script; and when it's loaded.
	 * @TODO Should there also be a "loading" boolean?
	 * @TODO Should all this happen via life events?
	 * @type {boolean}
	 */
	loaded : true,

	/**
	 * Automatically run the script on spirit.onenter()? 
	 *
	 * - any added <?param?> value will be undefined at this point
	 * - adding <?input?> will delay run until all input is loaded
	 * @type {boolean}
	 */
	autorun : true,

	/**
	 * Script has been run? Flipped after first run.
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
	 * @type {boolean}
	 */
	debug : false,

	/**
	 * Hm...
	 * @type {Map<String,object>}
	 */
	extras : null,
	
	/**
	 * Construction time.
	 *
	 * 1. don't autorun service scripts
	 * 2. use minimal updating system?
	 * 3. import script on startup 
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		var spirit = this.spirit;
		//this.functions = this.functions.bind ( this );
		this.inputs = this.inputs.bind ( this );
		if ( spirit instanceof edb.ScriptSpirit ) {
			this.autorun = false;
		} else if ( this.diff ) {
			this._updater = new edb.UpdateManager ( spirit );
		}
		if ( this.src ) {
			spirit.life.add ( gui.LIFE_ENTER, this );
		}
	},

	/**
	 * Waiting for onenter() to load the script. For some reason.
	 * @param {gui.Life} life
	 */
	onlife : function ( life ) {
		if ( life.type === gui.LIFE_ENTER ) {
			this.load ( this.src );
		}
	},

	/**
	 * Return function for URI.
	 * @param {String} href
	 * @returns {function}
	 *
	functions : function ( href ) {
		return edb.Function.get ( this.context, href );
	},
	*/

	/**
	 * Return data for input of type.
	 * @param {function} type
	 * @returns {object}
	 */
	inputs : function ( type ) {
		return this._script.input.get ( type );
	},

	/**
	 * Load script from SRC. This happens async unless the SRC 
	 * points to a script embedded in the spirits own document 
	 * (and unless script has already been loaded into context).
	 * @param {String} src 
	 * @param @optional {String} type Script mimetype (eg "text/edbml")
	 */
	load : function ( src, type ) {
		var context = this.spirit.window;
		edb.Template.load ( context, src, type || this.type, function ( script ) {
			this._compiled ( script );
		}, this );
	},

	/**
	 * Compile script from source text and run it when ready.
	 * @param {String} source Script source code
	 * @param @optional {String} type Script mimetype (eg "text/edbml")
	 * @param @optional {HashMap<String,String>} directives Optional compiler directives
	 */
	compile : function ( source, type, directives ) {
		var context = this.spirit.window;
		edb.Template.compile ( context, source,  type || this.type, directives, function ( script ) {
			this._compiled ( script );
		}, this );
	},

	/**
	 * Run script (with implicit arguments) and write result to DOM.
	 * @see {gui.SandBoxView#render}
	 */
	run : function () {
		if ( this._script ) {
			this._script.pointer = this.spirit; // TODO!
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
	 * @TODO Only do something if string argument has diffed 
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
			( this._latest = html ) !== this._latest // @TODO Support this kind of arg...
		);

		/*
		 * Time consume detected. Let's either not do this or 
		 * refactor into combo of tick, broadcast and action. 
		 * (no dom traversal should be involved in what it is)
		 */
		// this.spirit.action.dispatchGlobal ( gui.ACTION_DOCUMENT_FIT ); // emulate seamless iframes (?)
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
	 * Script compiled. Let's do this.
	 * @TODO life-event should probably go here...
	 * @param {edb.Script} script
	 */
	_compiled : function ( script ) {
		this._script = script;
		this.loaded = true;
		if ( this.debug ) {
			this._script.debug ();
		}
		if ( this.autorun ) {
			this.run ();
		}
	}


}, { // STATICS .........................................................................

	/**
	 * Construct when spirit constructs.
	 * @type {boolean}
	 */
	lazy : false

});
