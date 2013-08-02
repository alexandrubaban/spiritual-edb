/**
 * TODO: check if softupdate could mistarget the edb.ScriptUpdate.
 * TODO: move to updates folder.
 */
edb.ScriptUpdate = edb.Update.extend ( "edb.ScriptUpdate", {
	
	/**
	 * Update type.
	 * @type {String}
	 */
	type : "edbscript",

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
	 * @returns {edb.ScriptUpdate}
	 */
	setup : function ( spirit, selector, name, value, key ) {
		this._super.setup ();
		this._spirit = spirit;
		this._selector = selector;
		this._name = name;
		this._value = value;
		this._key = key;
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
					this._update ( element );
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
	_name : null,

	/**
	 * Attribute value (a generated method call)
	 * @type {String}
	 */
	_value : null,

	/**
	 * EDB script lookup key.
	 * TODO: use this to garbage collect unusable assignments.
	 * @type {String}
	 */
	_key : null,

	/**
	 * Update element.
	 * @param {Element} element
	 */
	_update : function ( element ) {
		var current = element.getAttribute ( this._name );
		if ( current && current.contains ( this._key )) {
			element.setAttribute ( this._name, this._value );
		} else {
			// perhaps there's an ID and we already performed an attribute update, could that be it?
			console.warn ( "Softupdate dysfunction or what? " + this._key + " not found in " + current );
		}
	},

	/**
	 * Debug changes.
	 */
	_report : function () {
		this._super._report ( "edb.ScriptUpdate " + this._selector );
	}

});