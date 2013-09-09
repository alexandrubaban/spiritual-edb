/**
 * Session persistant state.
 * @extends {edb.SessionState}
 */
edb.SessionState = edb.State.extend ({

}, { // Static .............................

	/**
	 * @type {edb.Storage}
	 */
	storage : edb.SessionStorage

});