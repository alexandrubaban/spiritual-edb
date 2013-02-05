/**
 * TODO: Description goes here.
 */
edb.ScriptSpirit = gui.Spirit.infuse ( "edb.ScriptSpirit", {
	
	/**
	 * Debug compiled function to console? You can set this in HTML:
	 * &lt;script type="text/edbml" debug="true"/&gt;
	 * @type {boolean}
	 */
	debug : false,
	
	/**
	 * Script file location (if not inline).
	 * @type {String}
	 */
	src : null,
	
	/**
	 * Script type.
	 * @type {String}
	 */
	type : "text/edbml",

	/**
	 * Map "gui.debug" to simply "debug".
	 */
	config : {
		map : {
			"debug" : "debug"
		}
	},
	
	/**
	 * Relay source code to the {edb.GenericScriptPlugin} 
	 * of parent spirit. Might need to load it first...
	 */
	onenter : function () {
		this._super.onenter ();
		this.type = this.att.get ( "type" ) || this.type;
		if ( !this._plainscript ()) {
			var src = this.att.get ( "src" ) || this.src;
			if ( src ) {
				this._load ( src );
			} else {
				gui.Tick.next ( function () {
					this._init ( this.dom.text ());
				}, this );
			}
		}
	},
	
	
	// PRIVATES ............................................................................
	
	/**
	 * Init view from source code. If script is placed in the BODY section, 
	 * we target the parent spirits view. TODO: functional-only in HEAD?
	 * @param {String} source
	 */
	_init : function ( source ) {
		var plugin = null;
		var parent = this.dom.parent ();
		if ( parent.localName === "head" ) {
			plugin = this.script;
		} else {
			if ( parent.spirit ) {
				plugin = parent.spirit.script;
			} else if ( gui.debug ) {
				console.warn ( "templates in document.body should be direct child of a spirit" );
			}
		}
		if ( plugin ) {
			var atts = this.att.getup (); // extra compile info
			plugin.compile ( source, this.type, this.debug, atts );
		}
	},

	/**
	 * Load source code from external location.
	 * @param {String} src
	 */
	_load : function ( src ) {
		var Loader = edb.GenericLoader.get ( this.type );
		new Loader ( this.document ).load ( src, function ( source ) {
			this._init ( source );
		}, this );
	},
	
	/**
	 * Is plain JS?
	 * TODO: regexp this not to break on vendor subsets (e4x etc)
	 * @returns {boolean}
	 */
	_plainscript : function () {
		var is = false;
		switch ( this.att.get ( "type" )) {
			case null :
			case "text/ecmacript" :
			case "text/javascript" :
			case "application/javascript" :
			case "application/x-javascript" :
				is = true;
				break;
		}
		return is;
	}
});
