/**
 * Session persistant storage.
 * @extends {edb.DOMStorage}
 */
edb.SessionStorage = edb.DOMStorage.extend ({

}, { // Static .................................

	/**
	 * Storage target.
	 * @type {LocalStorage}
	 */
	_domstorage : sessionStorage,

	/**
	 * Storage key.
	 * @type {String}
	 */
	_storagekey : "MyVendor.MyApp.SessionStorage"

});

/**
 * Write sync on context shutdown.
 */
( function shutdown () {
	gui.Broadcast.addGlobal ( 
		gui.BROADCAST_UNLOAD, 
		edb.SessionStorage 
	);
}());