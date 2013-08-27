/**
 * States are a conceptual rebranding of edb.Objects to serve primarily as spirit viewstate.
 */
edb.State = edb.Object.extend ({

}, { // Static ......................

	/**
	 * Non-persistant state. This is not particularly useful.
	 * @see {edb.SessionState}
	 * @see {edb.LocalState}
	 * @type {String}
	 */
	storage : null

});