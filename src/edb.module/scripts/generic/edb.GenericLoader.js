/**
 * The script loader will fetch a template string from external an 
 * document or scan the local document for templates in SCRIPT tags.
 * @extends {gui.FileLoader}
 */
edb.GenericLoader = gui.FileLoader.extend ({
	
	/**
	 * Load script source as text/plain.
	 * @overwrites {gui.FileLoader#load}
	 * @param {String} src
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	load : function ( src, callback, thisp ) {
		var url = new gui.URL ( this._document, src );
		if ( this._cache.has ( url.location )) {
			this._cached ( url, callback, thisp );
		} else if ( url.external ) {				
			this._request ( url, callback, thisp );
		} else {
			this._lookup ( url, callback, thisp );
		}
	},

	
	// PRIVATES ........................................................
	
	/**
	 * Lookup script in document DOM (as opposed to HTTP request).
	 * @param {gui.URL} url
	 * @param {Map<String,String>} cache
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	_lookup : function ( url, callback, thisp ) {
		var script = this._document.querySelector ( url.hash );
		this.onload ( script.textContent, url, callback, thisp );
	}


}, {}, { // STATICS ....................................................
	
	/**
	 * @static
	 * Mapping scriptloaders to mimetypes.
	 * @type {Map<String,edb.GenericLoader>}
	 */
	_loaders : new Map (),

	/**
	 * @static
	 * Register scriptloader for one or more mimetypes. 
	 * TODO: rename!
	 */
	set : function () { // implementation, ...mimetypes
		var args = gui.Type.list ( arguments );
		var impl = args.shift ();
		args.forEach ( function ( type ) {
			this._loaders.set ( type, impl );
		}, this );
	},
		
	/**
	 * @static
	 * Get loader for mimetype (what corresponds 
	 * to the "type" attribute of a script tag),
	 * TODO: rename!
	 * @param {String} type
	 * @returns {edb.GenericLoader}
	 */
	get : function ( type ) {
		var impl = edb.GenericLoader;
		if ( type ) {
			impl = this._loaders.get ( type );
			if ( !impl ) {
				throw new Error ( "No script loader registered for type: " + type );
			}
		}
		return impl;
	}
});