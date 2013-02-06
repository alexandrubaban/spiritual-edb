/**
 * The SpiritView acts to update the HTML subtree of a spirit.
 * @extends {gui.Plugin}
 */
edb.ScriptPlugin = gui.Plugin.extend ( "edb.ScriptPlugin", {

	/**
	 * Flipped after first run.
	 * @type {boolean}
	 */
	ran : false,

	/**
	 * Use minimal updates? If false, we write 
	 * the entire HTML subtree on all updates.
	 * @type {boolean}
	 */
	updating : true,
	
	/**
	 * Construction time again.
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		if ( this.updating ) { // using incremental updates?
			this._updater = new edb.UpdateManager ( this.spirit );
		}
	},
	
	/**
	 * Mapping imported functions to declared variable names.
	 * @returns {Map<String,function>}
	 */
	functions : function () {
		return this._script.functions;
	},

	/**
	 * Hm.
	 * returns {edb.Input}
	 */
	input : function () {
		return this._script.input;
	},

	/**
	 * Compile script and run it when ready.
	 * @param {String} source Script source code
	 * @param {String} type Script mimetype (eg "text/edbml")
	 * @param {boolean} debug Log something to console
	 * @param {HashMap<String,String>} atts Script tag attributes
	 */
	compile : function ( source, type, debug, atts ) {
		var Script = edb.GenericScript.get ( type );
		if ( !this._script ) {
			var that = this;
			this._script = new Script ( 
				this.spirit, this.spirit.window, 
				function onreadystatechange () {
					if ( this.readyState === edb.GenericScript.READY ) {
						that.run ();
					}
				}
			);
			this._script.compile ( source, debug, atts );
		} else {
			throw new Error ( "not supported: recompile edb.ScriptPlugin" ); // support this?
		}
	},
	
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
	 * @param {String} html
	 */
	write : function ( html ) {
		if ( this.updating ) {
			this._updater.update ( html );
		} else {
			this.spirit.dom.html ( html ); // TODO: forms markup make valid!
		}
		this.ran = true;
		this.spirit.life.dispatch ( 
			edb.LIFE_SCRIPT_DID_RUN,  
			( this._latest = html ) !== this._latest
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
	_updater : null
});
