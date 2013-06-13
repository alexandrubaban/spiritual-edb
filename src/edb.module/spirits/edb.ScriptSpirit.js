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
	
	onconfigure : function () {
		this._super.onconfigure ();
		this.att.add ( "debug" );
	},

	/**
	 * Map "debug" attribute to this.debug
	 * @param {gui.Att} att
	 */
	onatt : function ( att ) {
		this._super.onatt ( att );
		if ( att.name === "debug" ) {
			this.debug = att.value;
		}
	},
	
	/**
	 * Relay source code to the {edb.ScriptPlugin} of either this or parent spirit.
	 */
	onenter : function () {
		this._super.onenter ();
		if ( !this._plainscript ()) {
			if ( this.dom.parent ( gui.Spirit )) {
				this._initplugin ();
			}
		}
	},
	
	
	// PRIVATES ............................................................................
	
	/**
	 * Is plain JS?
	 * TODO: regexp this not to break on vendor subsets (e4x etc)
	 * TODO: forget about it, just require contains "edbml" ignorecase
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
	},

	/**
	 * Init an {edb.ScriptPlugin} from source code. If this script is placed directly
	 * inside a parent spirit, we target the parent spirits {edb.ScriptPlugin} (explain more)
	 */
	_initplugin : function () {
		var src = this.att.get ( "src" ) || this.src,
			type = this.att.get ( "type" ) || this.type,
			parent = this.dom.parent (),
			extras = this.att.getmap (),
			plugin = parent.spirit.script;
		plugin.extras = extras;
		plugin.debug = this.debug;
		if ( src ) {
			plugin.load ( src, type, extras );
		} else {
			plugin.compile ( this.dom.text (), type, extras );
		}
	}

});
