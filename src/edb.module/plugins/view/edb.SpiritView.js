/**
 * The SpiritView acts to update the HTML subtree of a spirit.
 * @extends {gui.SpiritPlugin}
 */
edb.SpiritView = gui.SpiritPlugin.extend ( "edb.SpiritView", {

	/**
	 * The edb.Script is bookkeeping data type input. 
	 * It triggers a readystate event when ready to run.  
	 * @type {edb.Script}
	 */
	script : null,
	
	/**
	 * Flipped after first render.
	 * @type {boolean}
	 */
	rendered : false,

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
	 * Compile script and run it when ready.
	 * @param {String} source Script source code
	 * @param {String} type Script mimetype (eg "text/edbml")
	 * @param {boolean} debug Log something to console
	 * @param {HashMap<String,String>} atts Script tag attributes
	 */
	compile : function ( source, type, debug, atts ) {
		
		var Script = edb.GenericScript.get ( type );

		if ( !this.script ) {
			var that = this;
			this.script = new Script ( 
				this.spirit, this.spirit.window, 
				function onreadystatechange () {
					if ( this.readyState === edb.GenericScript.READY ) {
						that.render ();
						/*
						if ( this.params.length === 0 ) { // auto-running script with zero params
							that.render ();
						}
						*/
					}
				}
			);
			this.script.compile ( source, debug, atts );
		} else {
			throw new Error ( "not supported: recompile edb.SpiritView" ); // support this?
		}
	},
	
	/**
	 * Run script and write result. Arguments will be fed to the script as params. 
	 * Nothing will happen if you serve the EDB script less params than expected!
	 * @see {gui.SandBoxView#render}
	 */
	render : function () {
		
		if ( this.script ) {
			this.write ( 
				this.script.run.apply ( 
					this.script, 
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

		this.rendered = true;
		this.spirit.life.dispatch ( "spirit-view-rendered" );
		console.warn ( "TODO: life event fired apart from first time???" );
		this.spirit.action.dispatchGlobal ( gui.ACTION_DOCUMENT_FIT ); // emulate seamless iframes
	},
	

	// PRIVATES ...........................................................................

	/**
	 * Update manager. 
	 * @type {edb.UpdateManager}
	 */
	_updater : null
});
