/**
 * Session persistant storage.
 * @extends {edb.DOMStorage}
 */
edb.SessionStorage = edb.DOMStorage.extend ({

}, { // Static .................................

	/**
	 * Storage target.
	 * @returns {SessionStorage}
	 */
	_domstorage : function ( context ) {
		return context.sessionStorage;
	},

	/**
	 * Storage key.
	 * @type {String}
	 */
	_storagekey : "MyVendor.MyApp.SessionStorage"

});

/**
 * Write sync on context shutdown.
 *
( function shutdown () {
	gui.Broadcast.addGlobal ( 
		gui.BROADCAST_UNLOAD, 
		edb.SessionStorage 
	);
}());
*/