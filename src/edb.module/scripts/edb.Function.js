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
	 * Mapping src to function.
	 * @type {Map<String,function>}
	 */
	_map : new Map (),

	/**
	 * Load dimsedut.
	 * @param {String} src
	 * @param {Window} win
	 * @returns {function} only if synchronous, otherwise wait for broadcast
	 */
	_load : function ( src, win ) {
		var result = null, loader = new edb.Loader ( win.document );
		loader.load ( src, function ( source ) {
			new edb.Script ( null, win, function onreadystatechange () {
				if ( this.readyState === edb.BaseScript.READY ) {
					edb.Function._map.set ( src, this._function );
					gui.Broadcast.dispatch ( null, edb.BROADCAST_FUNCTION_LOADED, src, win.gui.signature );
					result = this._function;
				}
			}).compile ( source, loader.directives );
		});
		return result; // might be undefined at this point if src is external...
	}

};