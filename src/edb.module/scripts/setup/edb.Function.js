/**
 * Hello.
 */
edb.Function = {

	/**
	 * Get function for SRC.
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function}
	 */
	get : function ( src, win ) { // TODO: pass document not window	
		src = new gui.URL ( win.document, src ).href;
		var result = this._map [ src ];
		if ( !result ) {
			result = this._load ( src, win );
		}
		return result;
	},

	/**
	 * Set function for SRC.
	 */
	set : function ( src, func ) {
		this._map [ src ] = func;
	},

	// PRIVATES ..................................................

	/**
	 * Mapping src to resolved function.
	 * @type {Map<String,function>}
	 */
	_map : Object.create ( null ),

	/**
	 * Load function from SRC (async) or lookup in local document (sync).
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function} only if sync (otherwise we wait for broadcast)
	 */
	_load : function ( src, win ) {
		var result = null;
		var sig = win.gui.signature;
		var msg = edb.BROADCAST_FUNCTION_LOADED;
		new edb.ScriptLoader ( win.document ).load ( src, function ( source, directives ) {
			new edb.Script ( null, win, function onreadystatechange () {
				if ( this.readyState === edb.ScriptBase.READY ) {
					if ( directives.tag ) {
						edb.Tag.set ( win, directives.tag, src );
					} else {
						edb.Function.set ( src, this._function );
					}
					gui.Broadcast.dispatch ( null, msg, src, sig );
					result = this._function;
				}
			}).compile ( source, directives );
		});
		return result;
	}

};