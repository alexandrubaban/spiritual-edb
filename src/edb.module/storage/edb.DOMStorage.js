/**
 * DOM storage.
 */
edb.DOMStorage = edb.Storage.extend ({

}, { // Recurring static ................................

	/**
	 * Write to storage blocking on top context shutdown.
	 * @param {gui.Broadcast} b
	 */
	onbroadcast : function ( b ) {
		if ( b.type === gui.BROADCAST_UNLOAD ) {
			if ( b.data === gui.$contextid ) {
				this.$write ( true );
			}
		}
	},


	// Private static .....................................

	/**
	 * Target is either sessionStorage or localStorage.
	 * @type {Storage}
	 */
	_domstorage : null,

	/**
	 * We're storing the whole thing under one single key. 
	 * @TODO: this key is hardcoded for now (see subclass).
	 * @type {String}
	 */
	_storagekey : null,

	/**
	 * Mapping Type constructors to (normalized) instance JSON.
	 * @type {Map<String,String>}
	 */
	_storagemap : null,


	// Secret static ......................................

	/**
	 * Get item.
	 * @param {String} key
	 * @param {function} callback
	 * @param @optional {Window|WorkerScope} context
	 */
	$getItem : function ( key, callback, context ) {
		var json = null;
		var type = null;
		var Type = null;
		var xxxx = this.$read ();
		if (( json = xxxx [ key ])) {
			json = JSON.parse ( json );
			Type = gui.Object.lookup ( key, context || self );
			type = Type ? new Type ( json ) : null;
		}
		callback.call ( this, type );
	},

	/**
	 * Set item.
	 * @param {String} key
	 * @param {function} callback
	 * @param {edb.Model|edb.Collection} item
	 */
	$setItem : function ( key, item, callback ) {
		var xxxx = this.$read ();
		xxxx [ key ] = item.$stringify ();
		this.$write ( false );
		callback.call ( this );
	},

	/**
	 * Remove item.
	 * @param {String} key
	 * @param {function} callback
	 */
	$removeItem : function ( key, callback ) {
		var xxxx = this.$read ();
		delete xxxx [ key ];
		this.$write ( false );
		callback.call ( this );
	},

	/**
	 * Clear the store.
	 * @param {function} callback
	 */
	$clear : function ( callback ) {
		this._domstorage.removeItem ( this._storagekey );
		this._storagemap = null;
		callback.call ( this );
	},

	/**
	 * Read from storage sync and blocking.
	 * @returns {Map<String,String>}
	 */
	$read : function () {
		if ( !this._storagemap ) {
			var map = this._domstorage.getItem ( this._storagekey );
			this._storagemap = map ? JSON.parse ( map ) : {};
		}
		return this._storagemap;
	},

	/**
	 * We write continually in case the browser crashes, 
	 * but async unless the top context is shutting down.
	 * @param {boolean} now
	 */
	$write : function ( now ) {
		var map = this._storagemap;
		var dom = this._domstorage;
		var key = this._storagekey;
		function write () {
			dom.setItem ( key, JSON.stringify ( map ));
		}
		if ( map ) {
			if ( now ) {
				write ();
			} else {
				setTimeout ( function unfreeze () {
					write ();
				}, 50 );
			}
		}
	}

});