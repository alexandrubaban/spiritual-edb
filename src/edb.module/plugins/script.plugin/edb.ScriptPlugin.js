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
	 * The Script SRC must be set before 'spirit.onenter()' 
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
	loaded : false,

	/**
	 * Automatically run the script on spirit.onenter()? 
	 * @TODO implement 'required' attribute on params instead...
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
	 * Waiting for onenter() to load the script (forgot why). This takes a
	 * repaint hit if and when the script gets loaded externally. @TODO: 
	 * all kinds of global preloading flags to render everything at once.
	 * @param {gui.Life} life
	 */
	onlife : function ( life ) {
		if ( life.type === gui.LIFE_ENTER ) {
			this.load ( this.src );
		}
	},

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
		edb.Template.load ( this.context, src, type || this.type, 
			function onreadystatechange ( script ) {
				this._onreadystatechange ( script );
				//this._onready ( script );
			},
		this );
	},

	/**
	 * Compile script from source TEXT and run it when ready.
	 * @param {String} source Script source code
	 * @param @optional {String} type Script mimetype (eg "text/edbml")
	 * @param @optional {HashMap<String,String>} directives Optional compiler directives
	 */
	compile : function ( source, type, directives ) {
		edb.Template.compile ( this.context, source,  type || this.type, directives, 
			function onreadystatechange ( script ) {
				this._onreadystatechange ( script );
				//this._onready ( script );
			}, 
		this );
	},

	/**
	 * Run script (with implicit arguments) and write result to DOM.
	 * @see {gui.SandBoxView#render}
	 */
	run : function () {
		if ( this.loaded ) {
			this._script.pointer = this.spirit; // TODO!
			this.write ( 
				this._script.run.apply ( 
					this._script, 
					arguments 
				)
			);
		} else {
			console.error ( "Running uncompiled script" );
		}
	},

	/**
	 * Private input.
	 * @param {object} data JSON object or array (demands arg 2) or an edb.Type instance (omit arg 2).
	 * @param @optional {function|String} type edb.Type constructor or "my.ns.MyType"
	 */
	input : function ( data, Type ) {
		var input = edb.Input.format ( this.context, data, Type );
		if ( this._script ) {
			this._script.input.match ( input );
		} else {
			this._doinput = this._doinput || [];
			this._doinput.push ( input );
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

		/**
		 * Fit any containing iframe in next tick.
		 * @TODO: make sure IframeSpirit consumes this if not set to fit
		 */
		if ( this.context.gui.hosted ) {
			var temptick = "temptick"; // @TODO
			var sig = this.context.gui.$contextid;
			gui.Tick.one ( temptick, this, sig ).dispatch ( temptick, 0, sig );
		}
	},

	/**
	 * If in an iframe, now is the time to fit the iframe 
	 * to potential new content (emulating seamless iframes).
	 * @param {gui.Tick} tick
	 */
	ontick : function ( tick ) {
		if ( tick.type === "temptick" ) {
			this.spirit.action.dispatchGlobal ( gui.ACTION_DOC_FIT );
		}
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

	/*
	 * Private input for script once loaded.
	 * @type {edb.Input}
	 */
	_doinput : null,

	/**
	 * Handle script state.
	 * @param {edb.Script} script
	 */
	_onreadystatechange : function ( script ) {
		this._script = this._script || script;
		switch ( script.readyState ) {
			case edb.Template.WAITING :
				if ( this._doinput ) {
					while ( this._doinput.length ) {
						this.input ( this._doinput.shift ());
					}
					this._doinput = null;
				}
				break;
			case edb.Template.READY :
				if ( !this.loaded ) {
					this.loaded = true;
					if ( this.debug ) {
						script.debug ();
					}
				}
				if ( this.autorun ) {
					this.run ();
				}
				break;
		}
	}


}, { // STATICS .........................................................................

	/**
	 * Constructed immediately.
	 * @overwrites (gui.Plugin#lazy)
	 * @type {boolean}
	 */
	lazy : false

});
