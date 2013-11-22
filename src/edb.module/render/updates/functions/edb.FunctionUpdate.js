/**
 * Updating the functions it is.
 * @TODO: revoke all functions in context on window.unload (if portalled)
 */
edb.FunctionUpdate = edb.Update.extend ({

	/**
	 * Update type.
	 * @type {String}
	 */
	type : edb.Update.TYPE_FUNCTION,

	/**
	 * Setup update.
	 * @param {String} id
	 * @param @optional {Map<String,String>} map
	 */
	setup : function ( id, map ) {
		this.id = id;
		this._map = map || null;
		return this;
	},

	/**
	 * Do the update.
	 */
	update : function () {
		var count = 0, elm = this.element ();
		if ( this._map ) {
			if (( count = edb.FunctionUpdate._remap ( elm, this._map ))) {
				this._report ( "remapped " + count + " keys" );
			}
		} else {
			if (( count = edb.FunctionUpdate._revoke ( elm ))) {
				this._report ( "revoked " + count + " keys" );
			}
		}
	},

	/**
	 * Report the update.
	 * @param {String} report
	 */
	_report : function ( report ) {
		this._super._report ( "edb.FunctionUpdate " + report );
	}

}, { // Static ......................................................

	/**
	 * @param {Element} element
	 */
	_revoke : function ( element ) {
		var count = 0, keys;
		this._getatts ( element ).forEach ( function ( att ) {
			keys = gui.KeyMaster.extractKey ( att.value );
			if ( keys ) {
				keys.forEach ( function ( key ) {
					edb.Script.$revoke ( key );
					count ++;
				});
			}
		});
		return count;
	},

	/**
	 * @param {Element} element
	 * @param {Map<String,String>} map
	 */
	_remap : function ( element, map ) {
		var count = 0, oldkeys, newkey;
		if ( Object.keys ( map ).length ) {
			this._getatts ( element ).forEach ( function ( att ) {
				if (( oldkeys = gui.KeyMaster.extractKey ( att.value ))) {
					oldkeys.forEach ( function ( oldkey ) {
						if (( newkey = map [ oldkey ])) {
							att.value = att.value.replace ( oldkey, newkey );
							edb.Script.$revoke ( oldkey );
							count ++;
						}
					});
				}
			});
		}
		return count;
	},

	/**
	 * Collect attributes from DOM subtree that 
	 * somewhat resemble EDBML poke statements.
	 * @returns {Array<Attribute>}
	 */
	_getatts : function ( element ) {
		var atts = [];
		new gui.Crawler ().descend ( element, {
			handleElement : function ( elm ) {
				Array.forEach ( elm.attributes, function ( att ) {
					if ( att.value.contains ( "edb.go" )) {
						atts.push ( att );
					}
				});
			}
		});
		return atts;
	}

});