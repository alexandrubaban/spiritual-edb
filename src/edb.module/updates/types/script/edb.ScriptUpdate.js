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
			console.warn ( "Softupdate dysfunction? " + this._key + " not found in " + current );
			//console.log ( this._name, this._key );
			//console.error ( "Target was moved: " + this._selector ); // TODO: test with soft update
		}
	},

	/**
	 * Debug changes.
	 */
	_report : function () {
		this._super._report ( "edb.ScriptUpdate " + this._selector );
	}

});

/**
 * Injecting support for edb.ScriptUpdate into the UpdateManager.
 * TODO: refactor something and come up with a mixin strategy
 */
( function () {

	var method = edb.UpdateManager.prototype._attschanged;

	/**
	 * When an attribute update is triggered by a EDB poke, we verify that this was the *only* thing
	 * that changed and substitute the default update with a edb.ScriptUpdate. This will bypass the need 
	 * for an ID attribute on the associated element (without which a hardupdate would have happened).
	 * @overloads {edb.UpdateManager#_attschanged}
	 * @param {NodeList} newatts
	 * @param {NodeList} oldatts
	 * @param {String} css
	 * @returns {boolean}
	 */
	edb.UpdateManager.prototype._attschanged = function ( newatts, oldatts, ids, css ) {
		if ( method.apply ( this, arguments )) { // attributes changed...
			return !Array.every ( newatts, function ( newatt ) {
				var oldatt = oldatts.getNamedItem ( newatt.name );
				var newhit = gui.KeyMaster.extractKey ( newatt.value );

				if ( newatt.name === "oninput" ) { // TODO
					console.error ( oldatt.value + "\n " + newatt.value + "\n" + ( oldatt !== null && oldatt.value === newatt.value ));
				}
				
				if ( newhit ) {
					var oldhit = gui.KeyMaster.extractKey ( oldatt.value );
					var update = new edb.ScriptUpdate ( this._doc ).setup ( 
						this._spirit, css, oldatt.name, newatt.value, oldhit [ 0 ]
					);
					this._updates.collect ( update, ids );
					return true; // pretend nothing changed
				} else {
					return false;
				}
			}, this );
		} else {
			return false;
		}
	};

})();