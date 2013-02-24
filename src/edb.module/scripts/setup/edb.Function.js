/**
 * Hello.
 */
edb.Function = {

	/**
	 * Get function for src.
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function}
	 */
	get : function ( src, win ) { // TODO: pass document not window	
		src = new gui.URL ( win.document, src ).href;
		var result = this._map.get ( src ) || null;
		if ( !result ) {
			result = this._load ( src, win );
		}
		return result;
	},


	// PRIVATES ..................................................

	/**
	 * Mapping src to resolved function.
	 * @type {Map<String,function>}
	 */
	_map : new Map (),

	/**
	 * Load function from SRC or lookup in local document.
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function} only if synchronous (otherwise we wait for broadcast)
	 */
	_load : function ( src, win ) {
		var result = null;
		new edb.ScriptLoader ( win.document ).load ( src, function ( source, directives ) {
			new edb.Script ( null, win, function onreadystatechange () {
				if ( this.readyState === edb.ScriptBase.READY ) {
					edb.Function._map.set ( src, this._function );
					gui.Broadcast.dispatch ( null, edb.BROADCAST_FUNCTION_LOADED, src, win.gui.signature );
					result = this._function;
				}
			}).compile ( source, directives );
		});
		return result;
	}

};