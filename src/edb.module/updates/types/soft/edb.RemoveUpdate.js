/**
 * Remove.
 * @extends {edb.SoftUpdate}
 */
edb.RemoveUpdate = edb.SoftUpdate.extend ( "edb.RemoveUpdate", {
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : edb.Update.TYPE_REMOVE,
	
	/**
	 * Setup update.
	 * @param {String} id
	 * @returns {edb.RemoveUpdate}
	 */
	setup : function ( id ) {
		
		this.id = id;
		return this;
	},
	
	/**
	 * Execute update.
	 */
	update : function () {
		
		var element = this.element ();
		var parent = element.parentNode;
		
		if ( this._beforeUpdate ( element )) {
			parent.removeChild ( element );
			this._afterUpdate ( parent );
			this._report ();
		}
	},
	
	/**
	 * Report.
	 * TODO: Push to update manager.
	 */
	_report : function () {
		
		this._super._report ( "edb.RemoveUpdate #" + this.id );
	}
});