/**
 * Device persistant storage.
 * @extends {edb.DOMStorage}
 */
edb.LocalStorage = edb.DOMStorage.extend ({

}, {  // Static ..............................

	/**
	 * Storage target.
	 * @type {LocalStorage}
	 */
	_domstorage : localStorage,

	/**
	 * Storage key.
	 * @type {String}
	 */
	_storagekey : "MyVendor.MyApp.LocalStorage"

});

/**
 * Write sync on context shutdown.
 */
( function shutdown () {
	gui.Broadcast.addGlobal ( 
		gui.BROADCAST_UNLOAD, 
		edb.LocalStorage 
	);
}());