/**
 * DOM storage.
 */
edb.DOMStorage = edb.Storage.extend ({

}, { // Recurring static ................................

	/**
	 * Write to storage blocking on top context shutdown.
	 * @param {gui.Broadcast} b
	 *
	onbroadcast : function ( b ) {
		if ( b.type === gui.BROADCAST_UNLOAD ) {
			if ( b.data === gui.$contextid ) {
				this.$write ( b.target.window, true );
			}
		}
	},
	*/


	// Private static .....................................

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

	/**
	 * Returns is either sessionStorage or localStorage.
	 * @returns {Storage}
	 */
	_domstorage : function () {},

	/**
	 * Timeout key for async write to storage.
	 * @type {number}
	 */
	_timeout : -1,


	// Secret static ......................................

	/**
	 * Get item.
	 * @param {String} key
	 * @param @optional {Window|WorkerScope} context
	 * @param {function} callback
	 */
	$getItem : function ( key, context, callback ) {
		var json = null;
		var type = null;
		var Type = null;
		var xxxx = this.$read ( context );
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
	 * @param @optional {boolean} now (temp mechanism)
	 */
	$setItem : function ( key, item, context, callback, now ) {
		var xxxx = this.$read ( context );
		xxxx [ key ] = item.stringify ();
		this.$write ( context, true );
		callback.call ( this );
	},

	/**
	 * Remove item.
	 * @param {String} key
	 * @param {function} callback
	 */
	$removeItem : function ( key, context, callback ) {
		var xxxx = this.$read ( context );
		delete xxxx [ key ];
		this.$write ( context, false );
		callback.call ( this );
	},

	/**
	 * Clear the store.
	 * @param {function} callback
	 */
	$clear : function ( context, callback ) {
		this._domstorage ( context ).removeItem ( this._storagekey );
		this._storagemap = null;
		callback.call ( this );
	},

	/**
	 * Read from storage sync and blocking.
	 * @returns {Map<String,String>}
	 */
	$read : function ( context ) {
		context = window;
		if ( !this._storagemap ) {
			var map = this._domstorage ( context ).getItem ( this._storagekey );
			this._storagemap = map ? JSON.parse ( map ) : {};
		}
		return this._storagemap;
	},

	/**
	 * We write continually in case the browser crashes, 
	 * but async unless the (top???) context is shutting down.
	 * @param {boolean} now
	 */
	$write : function ( context, now ) {
		clearTimeout ( this._timeout );
		var map = this._storagemap;
		var key = this._storagekey;
		var dom = this._domstorage ( context );
		context = window;
		function write () {
			try {
				dom.setItem ( key, JSON.stringify ( map ));
			} catch ( x ) {
				alert ( x );
			}
		}
		if ( map ) {
			if ( now || true ) {
				write ();
			} else {
				this._timeout = setTimeout ( function unfreeze () {
					write ();
				}, 50 );
			}
		}
	}

});