/**
 * Init parent spirit {edb.ScriptPlugin} if there is a parent spirit. 
 * When the parent spirit runs the script, this spirit will destruct.
 */
edb.ScriptSpirit = gui.Spirit.infuse ( "edb.ScriptSpirit", {

	/**
	 * Log compiled source to console?
	 * @type {boolean}
	 */
	debug : false,

	/**
	 * Hello.
	 */
	onenter : function () {
		this._super.onenter ();
		var parent = this.dom.parent ( gui.Spirit );
		if ( parent ) {
			this._initparentplugin ( parent );
		}
	},
	
	
	// Private .....................................................................

	/**
	 * Init {edb.ScriptPlugin} in parent spirit.
	 * @param {gui.Spirit} parent
	 */
	_initparentplugin : function ( parent ) {
		var src = this.att.get ( "src" );
		if ( src ) {
			parent.script.load ( src ); // diretives resolved from target script element
		} else {
			var directives = this.att.getmap ();
			directives.debug = directives.debug || this.debug;
			parent.script.compile ( this.dom.text (), directives );
		}
	}

});
