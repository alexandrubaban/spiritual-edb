/**
 * Spirit of the compiled EDBML script.
 */
edb.ScriptSpirit = gui.Spirit.extend ({

	/**
	 * Expected configured via inline HTML.
	 * @type {String}
	 */
	id : null,

	/**
	 * Load script into parent spirit. This spirit will 
	 * automatically destruct when the script executes.
	 */
	onenter : function () {
		this._super.onenter ();
		var id, parent = this.dom.parent ( gui.Spirit );
		if ( parent && ( id = this.id )) {
			parent.script.load ( gui.Object.lookup ( id ));
		}
	}

});