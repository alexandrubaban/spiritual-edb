/**
 * Append.
 * @extends {edb.SoftUpdate}
 */
edb.AppendUpdate = edb.SoftUpdate.extend ( "edb.AppendUpdate", {
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : edb.Update.TYPE_APPEND,
	
	/**
	 * Setup update.
	 * @param {String} id
	 * @param {Element} xelement
	 * @returns {edb.AppendUpdate}
	 */
	setup : function ( id, xelement ) {
		
		this.id = id;
		this.xelement = xelement;
		return this;
	},
	
	/**
	 * Execute update.
	 */
	update : function () {
		
		var parent = this.element ();
		var child = this._import ( parent );
		if ( this._beforeUpdate ( parent )) {
			parent.appendChild ( child );
			this._afterUpdate ( child );
			this._report ();
		}
	},
	
	/**
	 * Report.
	 * TODO: Push to update manager.
	 */
	_report : function () {
		
		this._super._report ( "edb.AppendUpdate #" + this.xelement.getAttribute ( "id" ));
	}
});