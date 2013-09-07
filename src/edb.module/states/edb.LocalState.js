/**
 * Device persistant state.
 * @extends {edb.LocalState}
 */
edb.LocalState = edb.State.extend ({

}, { // Static ...........................

	/**
	 * @type {edb.Storage}
	 */
	storage : edb.LocalStorage

});