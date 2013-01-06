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
			this._load ( src, win );
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
	 */
	_load : function ( src, win ) {

		new edb.Loader ( win.document ).load ( src, function ( source ) {
			new edb.Script ( null, win, function onreadystatechange () {
				if ( this.readyState === edb.GenericScript.READY ) {
					edb.Function._map.set ( src, this._function );
					gui.Broadcast.dispatchGlobal ( null, edb.BROADCAST_FUNCTION_LOADED, src );
				}
			}).compile ( source, win.gui.debug );
		});
	}

};