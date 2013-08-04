/**
 * TODO: check if softupdate could mistarget the edb.FunctionUpdate.
 * TODO: move to updates folder.
 */
edb.FunctionUpdate = edb.Update.extend ({
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : "function",

	/**
	 * Construct.
	 * @param {Document} doc
	 */
	onconstruct : function ( doc ) {
		this._super.onconstruct ( doc );
		this._summary = [];
	},
	
	/**
	 * Setup update.
	 * @param {gui.Spirit} spirit
	 * @param {String} selector
	 * @param {String} name
	 * @param {String} value
	 * @param {String} key
	 * @returns {edb.FunctionUpdate}
	 */
	setup : function ( spirit, selector, attname, newkey, oldkey ) {
		this._super.setup ();
		this._spirit = spirit;
		this._selector = selector;
		this._attname = attname;
		this._newkey = newkey;
		this._oldkey = oldkey;
		return this;
	},
	
	/**
	 * Update :)
	 */
	update : function () {
		this._super.update ();
		var element = null;
		try {
			element = this._spirit.dom.q ( this._selector );
		} catch ( domexception ) {
			throw new Error ( "Bad selector: " + this._selector );
		} finally {
			if ( element ) {
				if ( this._beforeUpdate ( element )) {
					this._update ( element, this._attname, this._newkey, this._oldkey );
					this._afterUpdate ( element );
					this._report ();
				}
			} else {
				throw new Error ( "No such element: " + this._selector );
			}
		} 
	},


	// PRIVATE ....................................................................
	
	/**
	 * Spirit who runs the EDB template (has the script element childnode).
	 * @type {[type]}
	 */
	_spirit : null,

	/**
	 * CSS selector to match the updated element.
	 * @type {String}
	 */
	_selector : null,

	/**
	 * Attribute name.
	 * @type {String}
	 */
	_attname : null,

	/**
	 * Old function lookup key.
	 * TODO: use this to garbage collect unusable assignments.
	 * @type {String}
	 */
	_oldkey : null,

	/**
	 * New function lookup key.
	 * @type {String}
	 */
	_newkey : null,

	/**
	 * Update element.
	 * @param {Element} element
	 */
	_update : function ( element, attname, newkey, oldkey ) {
		var newval, oldval = element.getAttribute ( attname );
		if ( oldval && oldval.contains ( oldkey )) {
			newval = oldval.replace ( oldkey, newkey );
			element.setAttribute ( attname, newval );
		} else {
			// perhaps there's an ID and we already performed an attribute update, could that be it?
			console.warn ( "Softupdate dysfunction or what?" );
		}
	},

	/**
	 * Debug changes.
	 */
	_report : function () {
		this._super._report ( "edb.FunctionUpdate " + this._selector );
	}

});